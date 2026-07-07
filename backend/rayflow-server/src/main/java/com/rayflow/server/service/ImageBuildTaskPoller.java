package com.rayflow.server.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.rayflow.server.mapper.FlinkJobVersionMapper;
import com.rayflow.server.model.entity.FlinkJobVersion;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;

/**
 * 后台定时轮询，将 Worker 容器中「正在构建」的镜像任务状态同步回 RayFlow 数据库。
 *
 * <p>轮询逻辑：
 * <ol>
 *   <li>查询所有 {@code image_publish_status = 'BUILDING'} 且持有 {@code image_build_task_id} 的版本记录；</li>
 *   <li>向 worker 查询每个 taskId 的状态；</li>
 *   <li>若任务已完成（SUCCEEDED / FAILED），更新版本记录和对应作业的 {@code applicationImage} 字段。</li>
 * </ol>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ImageBuildTaskPoller {

    private final FlinkJobVersionMapper flinkJobVersionMapper;
    private final ImageBuildWorkerClient workerClient;
    private final FlinkJobService flinkJobService;

    /**
     * 每 10 秒轮询一次。fixedDelay 保证上一次执行完毕后再等待 10s，避免并发堆积。
     */
    @Scheduled(fixedDelay = 10_000)
    public void poll() {
        List<FlinkJobVersion> buildingVersions = flinkJobVersionMapper.selectList(
                new LambdaQueryWrapper<FlinkJobVersion>()
                        .eq(FlinkJobVersion::getImagePublishStatus, "BUILDING")
                        .isNotNull(FlinkJobVersion::getImageBuildTaskId)
        );

        if (buildingVersions.isEmpty()) {
            return;
        }

        log.debug("[build-poller] checking {} building version(s)", buildingVersions.size());

        for (FlinkJobVersion version : buildingVersions) {
            try {
                pollOne(version);
            } catch (Exception e) {
                log.warn("[build-poller] failed to poll taskId={}: {}", version.getImageBuildTaskId(), e.getMessage());
            }
        }
    }

    private void pollOne(FlinkJobVersion version) {
        String taskId = version.getImageBuildTaskId();
        ImageBuildWorkerClient.WorkerTaskResponse status = workerClient.getTaskStatus(taskId);

        if (status == null) {
            log.debug("[build-poller] task not found on worker: taskId={} versionId={}", taskId, version.getId());
            return;
        }

        String workerStatus = status.getStatus();

        if (!"SUCCEEDED".equals(workerStatus) && !"FAILED".equals(workerStatus)) {
            // Still PENDING or RUNNING — wait for next poll cycle
            return;
        }

        // Map worker status → publish status
        String publishStatus = "SUCCEEDED".equals(workerStatus) ? "PUBLISHED" : "FAILED";

        version.setImagePublishStatus(publishStatus);
        version.setImageUri(status.getImageUri());
        version.setImageDigest(status.getImageDigest());
        version.setImagePublishLog(truncateLog(status.getLog()));
        flinkJobVersionMapper.updateById(version);

        if ("SUCCEEDED".equals(workerStatus) && StringUtils.hasText(status.getImageUri())) {
            flinkJobService.markVersionImagePublished(version, status.getImageUri(), status.getImageDigest(), truncateLog(status.getLog()));
        }

        log.info("[build-poller] taskId={} finished with status={} versionId={} imageUri={}",
                taskId, publishStatus, version.getId(), status.getImageUri());
    }

    private String truncateLog(String log) {
        if (log == null) return null;
        int maxLen = 12_000;
        return log.length() > maxLen ? log.substring(log.length() - maxLen) : log;
    }
}
