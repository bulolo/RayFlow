package com.rayflow.server.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.rayflow.flink.client.FlinkRestClient;
import com.rayflow.server.mapper.FlinkJobMapper;
import com.rayflow.server.model.entity.FlinkCluster;
import com.rayflow.server.model.entity.FlinkJob;
import com.rayflow.server.service.submit.K8sOperatorApplicationSubmitter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Flink 作业状态后台监控服务
 * <p>
 * 参考 StreamPark FlinkAppHttpWatcher 的设计，后端主动定时轮询所有 RUNNING 状态的 Flink 作业，
 * 通过 Flink REST API 同步真实运行状态到数据库。这样：
 * <ul>
 *   <li>前端列表查询只需读数据库，零延迟</li>
 *   <li>即使没有用户在线，状态也能及时更新</li>
 *   <li>为后续告警通知预留了扩展点</li>
 * </ul>
 */
@Slf4j
@Component
public class FlinkJobStatusWatcher {

    private final FlinkJobMapper flinkJobMapper;
    private final FlinkClusterService flinkClusterService;
    private final FlinkJobExecutionService flinkJobExecutionService;
    private final NotificationChannelService notificationChannelService;
    private final K8sOperatorApplicationSubmitter k8sOperatorApplicationSubmitter;

    @Value("${rayflow.flink.rest-connect-timeout-ms:3000}")
    private int connectTimeoutMs;

    @Value("${rayflow.flink.rest-read-timeout-ms:120000}")
    private int readTimeoutMs;

    @Value("${rayflow.flink.watcher.interval-seconds:5}")
    private int watchIntervalSeconds;

    private ScheduledExecutorService scheduler;

    /** 集群地址缓存，避免每次都查数据库 */
    private final Map<Long, FlinkCluster> clusterCache = new ConcurrentHashMap<>();

    public FlinkJobStatusWatcher(FlinkJobMapper flinkJobMapper,
                                 FlinkClusterService flinkClusterService,
                                 FlinkJobExecutionService flinkJobExecutionService,
                                 NotificationChannelService notificationChannelService,
                                 K8sOperatorApplicationSubmitter k8sOperatorApplicationSubmitter) {
        this.flinkJobMapper = flinkJobMapper;
        this.flinkClusterService = flinkClusterService;
        this.flinkJobExecutionService = flinkJobExecutionService;
        this.notificationChannelService = notificationChannelService;
        this.k8sOperatorApplicationSubmitter = k8sOperatorApplicationSubmitter;
    }

    @PostConstruct
    public void start() {
        scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "flink-job-status-watcher");
            t.setDaemon(true);
            return t;
        });
        scheduler.scheduleWithFixedDelay(this::doWatch, 10, watchIntervalSeconds, TimeUnit.SECONDS);
        log.info("[FlinkJobStatusWatcher] started, interval={}s", watchIntervalSeconds);
    }

    @PreDestroy
    public void stop() {
        if (scheduler != null && !scheduler.isShutdown()) {
            scheduler.shutdownNow();
            log.info("[FlinkJobStatusWatcher] stopped");
        }
    }

    /**
     * 核心轮询方法：查询所有 RUNNING 状态的作业，逐个同步 Flink 运行时状态
     */
    private void doWatch() {
        try {
            List<FlinkJob> runningJobs = flinkJobMapper.selectList(
                    new LambdaQueryWrapper<FlinkJob>()
                            .eq(FlinkJob::getStatus, "RUNNING")
                            .isNotNull(FlinkJob::getFlinkJobId)
                            .isNotNull(FlinkJob::getClusterId)
            );

            if (runningJobs.isEmpty()) {
                return;
            }

            log.debug("[FlinkJobStatusWatcher] watching {} running jobs", runningJobs.size());

            for (FlinkJob job : runningJobs) {
                try {
                    syncSingleJob(job);
                } catch (Exception e) {
                    log.warn("[FlinkJobStatusWatcher] failed to sync job id={}, flinkJobId={}: {}",
                            job.getId(), job.getFlinkJobId(), e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("[FlinkJobStatusWatcher] watch cycle error: {}", e.getMessage());
        }
    }

    /**
     * 同步单个作业的 Flink 运行时状态
     */
    private void syncSingleJob(FlinkJob job) {
        FlinkCluster cluster = resolveCluster(job.getClusterId());
        if (cluster == null) {
            return;
        }

        String mappedState;
        String errorLog = null;
        if (isK8sApplicationCluster(cluster)) {
            K8sOperatorApplicationSubmitter.OperatorStatus status = k8sOperatorApplicationSubmitter.getStatus(cluster, job.getFlinkJobId());
            if (status == null || status.status() == null || status.status().isBlank()) {
                return;
            }
            mappedState = status.status();
            errorLog = status.errorLog();
        } else {
            if (cluster.getAddress() == null) {
                return;
            }
            FlinkRestClient restClient = new FlinkRestClient(cluster.getAddress(), connectTimeoutMs, readTimeoutMs);
            String flinkState = restClient.getJobState(job.getFlinkJobId());
            if (flinkState == null || flinkState.isBlank()) {
                return;
            }
            mappedState = mapFlinkStatus(flinkState);
            errorLog = "FAILED".equals(mappedState) ? restClient.getJobExceptionLog(job.getFlinkJobId()) : null;
        }

        flinkJobExecutionService.syncStatus(job.getCurrentExecutionId(), mappedState, errorLog);

        boolean statusChanged = !mappedState.equals(job.getStatus());
        boolean clearCurrentFlinkJobId = shouldClearCurrentFlinkJobId(mappedState, job.getFlinkJobId());
        if (statusChanged || clearCurrentFlinkJobId) {
            String previousStatus = job.getStatus();
            String currentFlinkJobId = job.getFlinkJobId();
            job.setStatus(mappedState);
            if (clearCurrentFlinkJobId) {
                job.setFlinkJobId(null);
            }
            flinkJobMapper.updateById(job);
            log.info("[FlinkJobStatusWatcher] job status changed: id={}, flinkJobId={}, {} -> {}",
                    job.getId(), currentFlinkJobId, previousStatus, mappedState);

            if (statusChanged) {
                onJobStatusChanged(job, previousStatus, mappedState, currentFlinkJobId);
            }
        }
    }

    private void onJobStatusChanged(FlinkJob job, String previousStatus, String currentStatus, String currentFlinkJobId) {
        if (job.getAlertChannelId() == null) {
            return;
        }

        // 检查配置的告警规则是否包含当前变动状态
        String alertRule = job.getAlertRule() != null ? job.getAlertRule() : "FAILED";
        boolean shouldAlert = false;
        String eventName = "";

        if ("FAILED".equals(currentStatus) && alertRule.contains("FAILED")) {
            shouldAlert = true;
            eventName = "运行失败告警";
        } else if ("CANCELED".equals(currentStatus) && alertRule.contains("CANCELED")) {
            shouldAlert = true;
            eventName = "作业取消通知";
        } else if ("FINISHED".equals(currentStatus) && alertRule.contains("FINISHED")) {
            shouldAlert = true;
            eventName = "运行完成通知";
        }

        if (shouldAlert) {
            String title = String.format("[RayFlow] Flink 作业%s", eventName);
            String content = String.format(
                    "作业名称: %s\n" +
                    "作业 ID: %d\n" +
                    "Flink Job ID: %s\n" +
                    "原状态: %s\n" +
                    "新状态: %s",
                    job.getJobName(),
                    job.getId(),
                    currentFlinkJobId != null && !currentFlinkJobId.isBlank() ? currentFlinkJobId : "未知",
                    previousStatus,
                    currentStatus
            );
            try {
                notificationChannelService.sendAlert(job.getAlertChannelId(), title, content);
            } catch (Exception e) {
                log.error("[FlinkJobStatusWatcher] failed to send alert for job id={}: {}", job.getId(), e.getMessage());
            }
        }
    }

    /**
     * 从缓存或数据库解析集群信息
     */
    private FlinkCluster resolveCluster(Long clusterId) {
        return clusterCache.computeIfAbsent(clusterId, id -> {
            try {
                return flinkClusterService.getById(id);
            } catch (Exception e) {
                log.warn("[FlinkJobStatusWatcher] failed to resolve cluster id={}: {}", id, e.getMessage());
                return null;
            }
        });
    }

    /**
     * 清除集群缓存（集群配置变更时调用）
     */
    public void invalidateClusterCache(Long clusterId) {
        clusterCache.remove(clusterId);
    }

    public void invalidateAllClusterCache() {
        clusterCache.clear();
    }

    /**
     * Flink 作业运行状态映射函数（与 FlinkJobService 保持一致）
     */
    private static String mapFlinkStatus(String flinkStatus) {
        if (flinkStatus == null) return "UNKNOWN";
        switch (flinkStatus.toUpperCase()) {
            case "RUNNING":
            case "RESTARTING":
            case "INITIALIZING":
                return "RUNNING";
            case "FINISHED":
                return "FINISHED";
            case "FAILED":
            case "FAILING":
                return "FAILED";
            case "CANCELED":
            case "CANCELLING":
                return "CANCELED";
            case "SUSPENDED":
                return "SUSPENDED";
            default:
                return "CREATED";
        }
    }

    private static boolean isK8sApplicationCluster(FlinkCluster cluster) {
        return "kubernetes".equalsIgnoreCase(cluster.getClusterType())
                && "application".equalsIgnoreCase(cluster.getDeploymentMode());
    }

    private static boolean shouldClearCurrentFlinkJobId(String status, String flinkJobId) {
        return flinkJobId != null && !flinkJobId.isBlank() && isTerminalJobStatus(status);
    }

    private static boolean isTerminalJobStatus(String status) {
        return "FINISHED".equalsIgnoreCase(status)
                || "FAILED".equalsIgnoreCase(status)
                || "ERROR".equalsIgnoreCase(status)
                || "CANCELED".equalsIgnoreCase(status)
                || "CANCELLED".equalsIgnoreCase(status)
                || "STOPPED".equalsIgnoreCase(status)
                || "SUSPENDED".equalsIgnoreCase(status);
    }
}
