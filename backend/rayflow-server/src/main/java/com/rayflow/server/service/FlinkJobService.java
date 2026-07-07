package com.rayflow.server.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.flink.client.FlinkErrorParser;
import com.rayflow.flink.client.FlinkRestClient;
import com.rayflow.server.mapper.FlinkJobMapper;
import com.rayflow.server.mapper.FlinkJobVersionMapper;
import com.rayflow.server.model.entity.FlinkCluster;
import com.rayflow.server.model.entity.FlinkJob;
import com.rayflow.server.model.entity.FlinkJobExecution;
import com.rayflow.server.model.entity.FlinkJobVersion;
import com.rayflow.server.model.response.flink.FlinkJobResponse;
import com.rayflow.server.model.response.flink.FlinkJobVersionResponse;
import com.rayflow.server.service.submit.K8sOperatorApplicationSubmitter;
import com.rayflow.server.service.submit.RestFlinkJobSubmitter;
import com.rayflow.server.service.submit.SqlGatewayFlinkJobSubmitter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Flink 作业服务
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FlinkJobService extends ServiceImpl<FlinkJobMapper, FlinkJob> {

    private final FlinkClusterService flinkClusterService;
    private final TenantAccessService tenantAccessService;
    private final RestFlinkJobSubmitter restFlinkJobSubmitter;
    private final SqlGatewayFlinkJobSubmitter sqlGatewayFlinkJobSubmitter;
    private final K8sOperatorApplicationSubmitter k8sOperatorApplicationSubmitter;
    private final VariableService variableService;
    private final FlinkJobExecutionService flinkJobExecutionService;
    private final FlinkJobVersionMapper flinkJobVersionMapper;
    private final SystemDefaultsService systemDefaultsService;
    private final FlinkJarResourceService flinkJarResourceService;
    private final FlinkJobImagePublisher flinkJobImagePublisher;
    private final ObjectMapper objectMapper;

    @Value("${rayflow.flink.rest-connect-timeout-ms:3000}")
    private int connectTimeoutMs;

    @Value("${rayflow.flink.rest-read-timeout-ms:120000}")
    private int readTimeoutMs;

    public IPage<FlinkJob> pageJobs(Page<FlinkJob> page) {
        return pageJobs(page, null, null, null, null, null, null);
    }

    public IPage<FlinkJob> pageJobs(Page<FlinkJob> page, String keyword, String jobName, String jobTags, String status, String jobType, String runtimeMode) {
        String trimmedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        String trimmedJobName = StringUtils.hasText(jobName) ? jobName.trim() : null;
        String trimmedJobTags = StringUtils.hasText(jobTags) ? jobTags.trim() : null;
        String[] statusValues = StringUtils.hasText(status) ? status.split(",") : new String[0];
        return this.lambdaQuery()
                .eq(FlinkJob::getTenantId, tenantAccessService.requireCurrentTenantId())
                .and(StringUtils.hasText(trimmedKeyword), wrapper -> wrapper
                        .like(FlinkJob::getJobName, trimmedKeyword)
                        .or()
                        .like(FlinkJob::getJobGroup, trimmedKeyword)
                        .or()
                        .like(FlinkJob::getFlinkJobId, trimmedKeyword)
                        .or()
                        .like(FlinkJob::getDescription, trimmedKeyword)
                        .or()
                        .like(FlinkJob::getJobTags, trimmedKeyword))
                .like(StringUtils.hasText(trimmedJobName), FlinkJob::getJobName, trimmedJobName)
                .like(StringUtils.hasText(trimmedJobTags), FlinkJob::getJobTags, trimmedJobTags)
                .in(statusValues.length > 0, FlinkJob::getStatus, (Object[]) statusValues)
                .eq(StringUtils.hasText(jobType), FlinkJob::getJobType, jobType)
                .eq(StringUtils.hasText(runtimeMode), FlinkJob::getRuntimeMode, runtimeMode)
                .orderByDesc(FlinkJob::getId)
                .page(page);
    }

    public List<FlinkJob> listJobs(String keyword, String jobName, String jobTags, String status, String jobType, String runtimeMode) {
        String trimmedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        String trimmedJobName = StringUtils.hasText(jobName) ? jobName.trim() : null;
        String trimmedJobTags = StringUtils.hasText(jobTags) ? jobTags.trim() : null;
        String[] statusValues = StringUtils.hasText(status) ? status.split(",") : new String[0];
        return this.lambdaQuery()
                .eq(FlinkJob::getTenantId, tenantAccessService.requireCurrentTenantId())
                .and(StringUtils.hasText(trimmedKeyword), wrapper -> wrapper
                        .like(FlinkJob::getJobName, trimmedKeyword)
                        .or()
                        .like(FlinkJob::getJobGroup, trimmedKeyword)
                        .or()
                        .like(FlinkJob::getFlinkJobId, trimmedKeyword)
                        .or()
                        .like(FlinkJob::getDescription, trimmedKeyword)
                        .or()
                        .like(FlinkJob::getJobTags, trimmedKeyword))
                .like(StringUtils.hasText(trimmedJobName), FlinkJob::getJobName, trimmedJobName)
                .like(StringUtils.hasText(trimmedJobTags), FlinkJob::getJobTags, trimmedJobTags)
                .in(statusValues.length > 0, FlinkJob::getStatus, (Object[]) statusValues)
                .eq(StringUtils.hasText(jobType), FlinkJob::getJobType, jobType)
                .eq(StringUtils.hasText(runtimeMode), FlinkJob::getRuntimeMode, runtimeMode)
                .orderByDesc(FlinkJob::getId)
                .list();
    }

    public FlinkJob getRequired(Long id) {
        FlinkJob job = lambdaQuery()
                .eq(FlinkJob::getId, id)
                .eq(FlinkJob::getTenantId, tenantAccessService.requireCurrentTenantId())
                .last("LIMIT 1")
                .one();
        if (job == null) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
        return job;
    }

    public FlinkJob getRequiredForTenant(Long id, Long tenantId) {
        FlinkJob job = lambdaQuery()
                .eq(FlinkJob::getId, id)
                .eq(FlinkJob::getTenantId, tenantId)
                .last("LIMIT 1")
                .one();
        if (job == null) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
        return job;
    }

    /**
     * 同步 Flink 运行时中的作业运行状态到本地元数据库
     */
    public FlinkJob syncJobStatus(FlinkJob job) {
        if (job.getFlinkJobId() == null || job.getFlinkJobId().isBlank() || job.getClusterId() == null) {
            return job;
        }
        FlinkCluster cluster = flinkClusterService.getRequired(job.getClusterId());
        return syncJobStatus(job, cluster);
    }

    public FlinkJob syncJobStatusForTenant(FlinkJob job, Long tenantId) {
        if (job.getFlinkJobId() == null || job.getFlinkJobId().isBlank() || job.getClusterId() == null) {
            return job;
        }
        FlinkCluster cluster = flinkClusterService.getRequiredForTenant(job.getClusterId(), tenantId);
        return syncJobStatus(job, cluster);
    }

    private FlinkJob syncJobStatus(FlinkJob job, FlinkCluster cluster) {
        if (cluster == null) {
            return job;
        }
        try {
            String mappedState;
            String errorLog = null;
            if (isK8sApplicationCluster(cluster)) {
                K8sOperatorApplicationSubmitter.OperatorStatus status = k8sOperatorApplicationSubmitter.getStatus(cluster, job.getFlinkJobId());
                if (status == null || !StringUtils.hasText(status.status())) {
                    return job;
                }
                mappedState = status.status();
                errorLog = status.errorLog();
            } else {
                FlinkRestClient restClient = new FlinkRestClient(cluster.getAddress(), connectTimeoutMs, readTimeoutMs);
                String flinkState = restClient.getJobState(job.getFlinkJobId());
                if (!StringUtils.hasText(flinkState)) {
                    return job;
                }
                mappedState = mapFlinkStatus(flinkState);
                errorLog = "FAILED".equals(mappedState) ? restClient.getJobExceptionLog(job.getFlinkJobId()) : null;
            }
            flinkJobExecutionService.syncStatus(job.getCurrentExecutionId(), mappedState, errorLog);
            boolean statusChanged = !mappedState.equals(job.getStatus());
            boolean clearCurrentFlinkJobId = shouldClearCurrentFlinkJobId(mappedState, job.getFlinkJobId());
            if (statusChanged || clearCurrentFlinkJobId) {
                String currentFlinkJobId = job.getFlinkJobId();
                job.setStatus(mappedState);
                if (clearCurrentFlinkJobId) {
                    job.setFlinkJobId(null);
                }
                this.updateById(job);
                log.info("Job status synced: id={}, flinkJobId={}, newStatus={}", job.getId(), currentFlinkJobId, mappedState);
            }
        } catch (Exception e) {
            log.warn("Failed to sync Flink job status for job ID={}: {}", job.getId(), e.getMessage());
        }
        return job;
    }

    public FlinkJob createJob(FlinkJob job) {
        FlinkCluster cluster = flinkClusterService.getRequired(job.getClusterId());

        job.setClusterId(cluster.getId());
        job.setTenantId(tenantAccessService.requireCurrentTenantId());
        job.setCreatedBy(tenantAccessService.requireCurrentUser().getId());
        job.setStatus("CREATED");
        job.setPublishStatus("UNPUBLISHED");
        this.save(job);
        log.info("Flink job created: id={}, name={}, type={}", job.getId(), job.getJobName(), job.getJobType());
        return job;
    }

    public FlinkJob startJob(Long id) {
        FlinkJob job = getRequired(id);
        if (!"PUBLISHED".equals(job.getPublishStatus())) {
            String message = "UNPUBLISHED".equals(job.getPublishStatus())
                    ? "作业还没有发布版本，请先发布后再运行"
                    : "当前作业存在未发布改动，请先发布最新版本后再运行";
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), message);
        }
        FlinkJobVersion version = latestVersionRequired(job.getId(), job.getTenantId());
        return startJob(job, tenantAccessService.requireCurrentTenantId(), version);
    }

    public FlinkJob startJobForTenant(Long id, Long tenantId) {
        FlinkJob job = getRequiredForTenant(id, tenantId);
        if (!"PUBLISHED".equals(job.getPublishStatus())) {
            String message = "UNPUBLISHED".equals(job.getPublishStatus())
                    ? "作业还没有发布版本，请先发布后再运行"
                    : "当前作业存在未发布改动，请先发布最新版本后再运行";
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), message);
        }
        FlinkJobVersion version = latestVersionRequired(job.getId(), tenantId);
        return startJob(job, tenantId, version);
    }

    public FlinkJob debugJob(Long id) {
        FlinkJob job = getRequired(id);
        return startJob(job, tenantAccessService.requireCurrentTenantId(), null);
    }

    private FlinkJob startJob(FlinkJob job, Long tenantId, FlinkJobVersion version) {
        if ("RUNNING".equals(job.getStatus())) {
            job = syncJobStatusForTenant(job, tenantId);
        }
        if ("RUNNING".equals(job.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "作业已在运行中，不能重复启动");
        }
        FlinkCluster cluster = flinkClusterService.getRequiredForTenant(job.getClusterId(), tenantId);
        if (StringUtils.hasText(job.getDependencyRefs()) && !"SQL".equalsIgnoreCase(job.getJobType())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "JAR 依赖资源当前仅支持 SQL 作业自动加载");
        }
        flinkClusterService.ensureSupportedFlink2Cluster(cluster);
        FlinkJob runtimeJob = version == null ? copyJobForRuntime(job) : copyJobForRuntime(readSnapshot(version, job));
        boolean k8sApplication = isK8sApplicationJob(runtimeJob) || isK8sApplicationCluster(cluster);
        if (k8sApplication) {
            prepareK8sApplicationRuntimeJob(runtimeJob, cluster, version);
        }
        FlinkJobExecution execution = flinkJobExecutionService.createSubmitting(
                job.getId(),
                version == null ? null : version.getId(),
                version == null ? null : version.getVersionName(),
                tenantId,
                job.getCreatedBy()
        );
        job.setCurrentExecutionId(execution.getId());
        job.setFlinkJobId(null);
        job.setStatus("SUBMITTING");
        this.updateById(job);
        flinkJobExecutionService.pruneByJob(job.getId(), tenantId, systemDefaultsService.jobExecutionRetention(tenantId));
        flinkJobExecutionService.attachSubmitPayload(execution, buildSubmitPayload(runtimeJob, cluster, version));

        try {
            String flinkJobId;
            if (k8sApplication) {
                flinkJobId = k8sOperatorApplicationSubmitter.submit(runtimeJob, cluster);
            } else if ("SQL_GATEWAY".equalsIgnoreCase(runtimeJob.getSubmitType())) {
                flinkJobId = sqlGatewayFlinkJobSubmitter.submit(runtimeJob, cluster);
            } else {
                flinkJobId = restFlinkJobSubmitter.submit(runtimeJob, cluster);
            }
            job.setFlinkJobId(flinkJobId);
            job.setStatus("RUNNING");
            flinkJobExecutionService.markRunning(execution, flinkJobId);
        } catch (BusinessException e) {
            job.setStatus("FAILED");
            job.setFlinkJobId(null);
            flinkJobExecutionService.markFailed(execution, FlinkErrorParser.formatFull(e));
            this.updateById(job);
            throw e;
        } catch (Exception e) {
            log.error("Failed to start job: {}", e.getMessage());
            job.setStatus("FAILED");
            job.setFlinkJobId(null);
            flinkJobExecutionService.markFailed(execution, FlinkErrorParser.formatFull(e));
            this.updateById(job);
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "启动作业失败: " + FlinkErrorParser.parse(e));
        }

        this.updateById(job);
        log.info("Job started successfully: id={}, name={}, flinkJobId={}, status={}",
                job.getId(), job.getJobName(), job.getFlinkJobId(), job.getStatus());
        return job;
    }

    private String buildSubmitPayload(FlinkJob job, FlinkCluster cluster, FlinkJobVersion version) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("submitter", job.getSubmitType());
        payload.put("jobId", job.getId());
        payload.put("jobName", job.getJobName());
        payload.put("jobType", job.getJobType());
        payload.put("runtimeMode", job.getRuntimeMode());
        payload.put("executionMode", job.getExecutionMode());
        payload.put("clusterId", job.getClusterId());
        payload.put("clusterName", cluster.getClusterName());
        payload.put("clusterAddress", cluster.getAddress());
        payload.put("gatewayAddress", cluster.getGatewayAddress());
        payload.put("kubernetesNamespace", cluster.getNamespaceName());
        payload.put("kubernetesServiceAccount", cluster.getServiceAccount());
        payload.put("kubernetesImage", cluster.getImage());
        payload.put("kubernetesServiceExposureType", cluster.getServiceExposureType());
        payload.put("versionId", version == null ? null : version.getId());
        payload.put("versionName", version == null ? "草稿" : version.getVersionName());
        payload.put("parallelism", job.getParallelism());
        payload.put("savepointPath", job.getSavepointPath());
        payload.put("args", job.getArgs());
        payload.put("flinkConfig", job.getFlinkConfig());
        payload.put("jarUri", job.getJarUri());
        payload.put("mainClass", job.getMainClass());
        payload.put("dependencyRefs", job.getDependencyRefs());
        payload.put("resolvedClasspaths", flinkJarResourceService.resolveActiveStorageUrisForTenant(job.getDependencyRefs(), job.getTenantId()));
        payload.put("applicationImage", job.getApplicationImage());
        payload.put("sql", "SQL".equalsIgnoreCase(job.getJobType()) ? job.getContent() : null);
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "作业提交参数快照序列化失败");
        }
    }

    private FlinkJob copyJobForRuntime(FlinkJob source) {
        FlinkJob runtime = new FlinkJob();
        runtime.setId(source.getId());
        runtime.setJobName(source.getJobName());
        runtime.setJobGroup(source.getJobGroup());
        runtime.setJobType(source.getJobType());
        runtime.setRuntimeMode(normalizeRuntimeMode(source));
        runtime.setSubmitType(source.getSubmitType());
        runtime.setExecutionMode(source.getExecutionMode());
        runtime.setClusterId(source.getClusterId());
        runtime.setAlertChannelId(source.getAlertChannelId());
        runtime.setAlertRule(source.getAlertRule());
        runtime.setFlinkJobId(source.getFlinkJobId());
        runtime.setCurrentExecutionId(source.getCurrentExecutionId());
        runtime.setStatus(source.getStatus());
        runtime.setPublishStatus(source.getPublishStatus());
        runtime.setContent("SQL".equalsIgnoreCase(source.getJobType())
                ? applySqlRuntimeMode(variableService.renderSql(source.getContent(), source.getTenantId()), runtime.getRuntimeMode())
                : source.getContent());
        runtime.setMainClass(source.getMainClass());
        runtime.setArgs(source.getArgs());
        runtime.setFlinkConfig(source.getFlinkConfig());
        runtime.setParallelism(source.getParallelism());
        runtime.setSavepointPath(source.getSavepointPath());
        runtime.setApplicationImage(source.getApplicationImage());
        runtime.setJarUri(source.getJarUri());
        runtime.setDependencyRefs(source.getDependencyRefs());
        runtime.setDescription(source.getDescription());
        runtime.setTenantId(source.getTenantId());
        runtime.setCreatedBy(source.getCreatedBy());
        runtime.setCreatedAt(source.getCreatedAt());
        runtime.setUpdatedAt(source.getUpdatedAt());
        runtime.setDeleted(source.getDeleted());
        return runtime;
    }

    private void prepareK8sApplicationRuntimeJob(FlinkJob runtimeJob, FlinkCluster cluster, FlinkJobVersion version) {
        if (version == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "K8s Application 只能运行发布版本，请先发布并等待镜像构建完成");
        }
        if (!isK8sApplicationCluster(cluster)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "K8s Application 作业必须选择 Kubernetes Application 运行时");
        }
        if (!"PUBLISHED".equalsIgnoreCase(version.getImagePublishStatus()) || !StringUtils.hasText(version.getImageUri())) {
            String status = StringUtils.hasText(version.getImagePublishStatus()) ? version.getImagePublishStatus() : "未开始";
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "K8s Application 镜像尚未构建完成，当前状态: " + status);
        }
        runtimeJob.setSubmitType("K8S_APPLICATION");
        runtimeJob.setExecutionMode("k8s-application");
        runtimeJob.setApplicationImage(version.getImageUri());
        if (!StringUtils.hasText(runtimeJob.getJarUri())) {
            runtimeJob.setJarUri(FlinkJobImagePublisher.SQL_RUNNER_JAR_URI);
        }
        if (!StringUtils.hasText(runtimeJob.getMainClass())) {
            runtimeJob.setMainClass("com.rayflow.flink.sqlrunner.RayFlowSqlRunner");
        }
        if ("SQL".equalsIgnoreCase(runtimeJob.getJobType())) {
            runtimeJob.setArgs(buildK8sSqlRunnerArgs(runtimeJob));
        }
    }

    private static String normalizeRuntimeMode(FlinkJob job) {
        if (!"SQL".equalsIgnoreCase(job.getJobType())) {
            return null;
        }
        String value = job.getRuntimeMode();
        if ("BATCH".equalsIgnoreCase(value)) {
            return "BATCH";
        }
        return "STREAMING";
    }

    private static String applySqlRuntimeMode(String sql, String runtimeMode) {
        if (sql == null || sql.isBlank()) {
            return sql;
        }
        String normalizedMode = "BATCH".equalsIgnoreCase(runtimeMode) ? "BATCH" : "STREAMING";
        StringBuilder cleaned = new StringBuilder();
        for (String line : sql.replace("\r\n", "\n").split("\n")) {
            String normalizedLine = line.trim().toUpperCase();
            if (normalizedLine.matches("^SET\\s+['\"]?EXECUTION\\.RUNTIME-MODE['\"]?\\s*=.*;?$")) {
                continue;
            }
            cleaned.append(line).append('\n');
        }
        return "SET 'execution.runtime-mode' = '" + normalizedMode + "';\n\n" + cleaned.toString().trim();
    }

    /**
     * 取消作业
     */
    public void cancelJob(Long id) {
        FlinkJob job = getRequired(id);
        cancelJob(job, tenantAccessService.requireCurrentTenantId());
    }

    public void cancelJobForTenant(Long id, Long tenantId) {
        FlinkJob job = getRequiredForTenant(id, tenantId);
        cancelJob(job, tenantId);
    }

    private void cancelJob(FlinkJob job, Long tenantId) {
        if (job.getFlinkJobId() == null || job.getFlinkJobId().isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Flink Job ID 为空，无法取消运行作业");
        }
        FlinkCluster cluster = flinkClusterService.getRequiredForTenant(job.getClusterId(), tenantId);
        
        try {
            if (isK8sApplicationCluster(cluster) || isK8sApplicationJob(job)) {
                k8sOperatorApplicationSubmitter.cancel(cluster, job.getFlinkJobId());
            } else {
                new FlinkRestClient(cluster.getAddress(), connectTimeoutMs, readTimeoutMs).cancelJob(job.getFlinkJobId());
            }
        } catch (Exception e) {
            log.error("Failed to cancel Flink physical job for flinkJobId={}: {}", job.getFlinkJobId(), e.getMessage());
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "远程 Flink 任务停止失败: " + e.getMessage());
        }
        
        String canceledFlinkJobId = job.getFlinkJobId();
        job.setStatus("CANCELED");
        job.setFlinkJobId(null);
        flinkJobExecutionService.syncCanceled(job.getCurrentExecutionId());
        this.updateById(job);
        log.info("Job canceled: id={}, flinkJobId={}", job.getId(), canceledFlinkJobId);
    }

    public void deleteJob(Long id) {
        FlinkJob job = getRequired(id);
        if ("RUNNING".equals(job.getStatus())) {
            job = syncJobStatus(job);
        }
        if ("RUNNING".equals(job.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "作业正在运行中，请先取消后再删除");
        }
        flinkJobVersionMapper.delete(new LambdaQueryWrapper<FlinkJobVersion>()
                .eq(FlinkJobVersion::getJobId, job.getId())
                .eq(FlinkJobVersion::getTenantId, job.getTenantId()));
        removeById(id);
    }

    public void updateJob(Long id, FlinkJob nextJob) {
        FlinkJob existing = getRequired(id);
        if ("RUNNING".equals(existing.getStatus())) {
            existing = syncJobStatus(existing);
        }
        if ("RUNNING".equals(existing.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "作业正在运行中，不能修改定义");
        }
        nextJob.setId(existing.getId());
        nextJob.setTenantId(existing.getTenantId());
        nextJob.setCreatedBy(existing.getCreatedBy());
        nextJob.setFlinkJobId(existing.getFlinkJobId());
        nextJob.setCurrentExecutionId(existing.getCurrentExecutionId());
        nextJob.setStatus(existing.getStatus());
        nextJob.setPublishStatus(resolvePublishStatusAfterUpdate(existing, nextJob));
        updateById(nextJob);
    }

    public FlinkJobVersionResponse publishVersion(Long jobId, String remark) {
        FlinkJob job = getRequired(jobId);
        Integer nextVersionNo = nextVersionNo(job.getId(), job.getTenantId());

        // 异步提交镜像构建给 worker 容器（非阻塞，立即返回 taskId）
        String buildTaskId = flinkJobImagePublisher.submitBuild(job, nextVersionNo);

        // 对 K8s SQL 作业，预设 jar/class/args，等镜像构建完成后 applicationImage 由 poller 回填
        boolean isK8sBuild = buildTaskId != null;
        if (isK8sBuild) {
            job.setJarUri(FlinkJobImagePublisher.SQL_RUNNER_JAR_URI);
            job.setMainClass("com.rayflow.flink.sqlrunner.RayFlowSqlRunner");
            job.setArgs(buildK8sSqlRunnerArgs(job));
        }

        FlinkJobVersion version = new FlinkJobVersion();
        version.setJobId(job.getId());
        version.setVersionNo(nextVersionNo);
        version.setVersionName("V" + nextVersionNo);
        version.setSnapshotJson(writeSnapshot(FlinkJobResponse.from(job)));
        version.setRemark(StringUtils.hasText(remark) ? remark.trim() : "发布作业版本 V" + nextVersionNo);
        // 镜像构建中：status=BUILDING；非 K8s 作业无需构建时为 null
        version.setImagePublishStatus(isK8sBuild ? "BUILDING" : null);
        version.setImageBuildTaskId(buildTaskId);
        version.setTenantId(job.getTenantId());
        version.setCreatedBy(tenantAccessService.requireCurrentUser().getId());
        flinkJobVersionMapper.insert(version);

        job.setPublishStatus("PUBLISHED");
        updateById(job);
        pruneJobVersions(job.getId(), job.getTenantId(), systemDefaultsService.jobVersionRetention(job.getTenantId()));
        return FlinkJobVersionResponse.from(version);
    }

    public void markVersionImagePublished(FlinkJobVersion version, String imageUri, String imageDigest, String imagePublishLog) {
        if (version == null || !StringUtils.hasText(imageUri)) {
            return;
        }
        FlinkJob job = getById(version.getJobId());
        if (job == null) {
            return;
        }
        FlinkJob snapshot = readSnapshot(version, job);
        applyK8sPublishedImage(snapshot, imageUri);
        version.setImageUri(imageUri);
        version.setImageDigest(imageDigest);
        version.setImagePublishLog(imagePublishLog);
        version.setSnapshotJson(writeSnapshot(FlinkJobResponse.from(snapshot)));
        flinkJobVersionMapper.updateById(version);

        FlinkJobVersion latest = latestVersion(job.getId(), job.getTenantId());
        if (latest != null && latest.getId().equals(version.getId()) && "PUBLISHED".equalsIgnoreCase(job.getPublishStatus())) {
            applyK8sPublishedImage(job, imageUri);
            updateById(job);
        }
        log.info("K8s application image published: jobId={}, versionId={}, image={}", job.getId(), version.getId(), imageUri);
    }

    private void applyK8sPublishedImage(FlinkJob job, String imageUri) {
        job.setApplicationImage(imageUri);
        job.setJarUri(FlinkJobImagePublisher.SQL_RUNNER_JAR_URI);
        job.setMainClass("com.rayflow.flink.sqlrunner.RayFlowSqlRunner");
        job.setArgs(buildK8sSqlRunnerArgs(job));
    }

    private String buildK8sSqlRunnerArgs(FlinkJob job) {
        if (StringUtils.hasText(job.getArgs()) && job.getArgs().contains("--sql-file")) {
            return job.getArgs().trim();
        }
        String jobNameBase64 = java.util.Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(job.getJobName().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        String args = "--sql-file " + FlinkJobImagePublisher.SQL_FILE_PATH
                + " --job-name-base64 " + jobNameBase64
                + " --parallelism " + (job.getParallelism() == null ? 1 : job.getParallelism());
        return StringUtils.hasText(job.getArgs()) ? args + " " + job.getArgs().trim() : args;
    }

    public List<FlinkJobVersionResponse> listVersions(Long jobId) {
        FlinkJob job = getRequired(jobId);
        int retention = systemDefaultsService.jobVersionRetention(job.getTenantId());
        return flinkJobVersionMapper.selectList(new LambdaQueryWrapper<FlinkJobVersion>()
                        .eq(FlinkJobVersion::getJobId, job.getId())
                        .eq(FlinkJobVersion::getTenantId, job.getTenantId())
                        .orderByDesc(FlinkJobVersion::getVersionNo)
                        .last("LIMIT " + retention))
                .stream()
                .map(FlinkJobVersionResponse::from)
                .toList();
    }

    private void pruneJobVersions(Long jobId, Long tenantId, int retention) {
        List<Long> retainedIds = flinkJobVersionMapper.selectList(new LambdaQueryWrapper<FlinkJobVersion>()
                        .select(FlinkJobVersion::getId)
                        .eq(FlinkJobVersion::getJobId, jobId)
                        .eq(FlinkJobVersion::getTenantId, tenantId)
                        .orderByDesc(FlinkJobVersion::getVersionNo)
                        .last("LIMIT " + Math.max(1, retention)))
                .stream()
                .map(FlinkJobVersion::getId)
                .toList();
        LambdaQueryWrapper<FlinkJobVersion> query = new LambdaQueryWrapper<FlinkJobVersion>()
                .eq(FlinkJobVersion::getJobId, jobId)
                .eq(FlinkJobVersion::getTenantId, tenantId);
        if (!retainedIds.isEmpty()) {
            query.notIn(FlinkJobVersion::getId, retainedIds);
        }
        flinkJobVersionMapper.delete(query);
    }

    private Integer nextVersionNo(Long jobId, Long tenantId) {
        FlinkJobVersion latest = flinkJobVersionMapper.selectOne(new LambdaQueryWrapper<FlinkJobVersion>()
                .eq(FlinkJobVersion::getJobId, jobId)
                .eq(FlinkJobVersion::getTenantId, tenantId)
                .orderByDesc(FlinkJobVersion::getVersionNo)
                .last("LIMIT 1"));
        return latest == null ? 1 : latest.getVersionNo() + 1;
    }

    private String writeSnapshot(FlinkJobResponse job) {
        try {
            return objectMapper.writeValueAsString(job);
        } catch (JsonProcessingException e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "作业版本快照序列化失败");
        }
    }

    private FlinkJobVersion latestVersionRequired(Long jobId, Long tenantId) {
        FlinkJobVersion version = latestVersion(jobId, tenantId);
        if (version == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "作业还没有发布版本，请先发布后再运行");
        }
        return version;
    }

    private FlinkJobVersion latestVersion(Long jobId, Long tenantId) {
        return flinkJobVersionMapper.selectOne(new LambdaQueryWrapper<FlinkJobVersion>()
                .eq(FlinkJobVersion::getJobId, jobId)
                .eq(FlinkJobVersion::getTenantId, tenantId)
                .orderByDesc(FlinkJobVersion::getVersionNo)
                .last("LIMIT 1"));
    }

    private String resolvePublishStatusAfterUpdate(FlinkJob existing, FlinkJob nextJob) {
        FlinkJobVersion latest = latestVersion(existing.getId(), existing.getTenantId());
        if (latest == null) {
            return "UNPUBLISHED";
        }
        return samePublishDefinition(nextJob, readSnapshot(latest, existing)) ? "PUBLISHED" : "OUTDATED";
    }

    private FlinkJob readSnapshot(FlinkJobVersion version, FlinkJob currentJob) {
        try {
            FlinkJobResponse snapshot = objectMapper.readValue(version.getSnapshotJson(), FlinkJobResponse.class);
            FlinkJob job = new FlinkJob();
            job.setId(currentJob.getId());
            job.setJobName(snapshot.getJobName());
            job.setJobGroup(snapshot.getJobGroup());
            job.setJobType(snapshot.getJobType());
            job.setRuntimeMode(snapshot.getRuntimeMode());
            job.setSubmitType(snapshot.getSubmitType());
            job.setExecutionMode(snapshot.getExecutionMode());
            job.setClusterId(snapshot.getClusterId());
            job.setAlertChannelId(snapshot.getAlertChannelId());
            job.setAlertRule(snapshot.getAlertRule());
            job.setFlinkJobId(currentJob.getFlinkJobId());
            job.setCurrentExecutionId(currentJob.getCurrentExecutionId());
            job.setStatus(currentJob.getStatus());
            job.setPublishStatus(currentJob.getPublishStatus());
            job.setContent(snapshot.getContent());
            job.setMainClass(snapshot.getMainClass());
            job.setArgs(snapshot.getArgs());
            job.setFlinkConfig(snapshot.getFlinkConfig());
            job.setParallelism(snapshot.getParallelism());
            job.setSavepointPath(snapshot.getSavepointPath());
            job.setApplicationImage(snapshot.getApplicationImage());
            job.setJarUri(snapshot.getJarUri());
            job.setDependencyRefs(snapshot.getDependencyRefs());
            job.setDescription(snapshot.getDescription());
            job.setJobTags(snapshot.getJobTags());
            job.setDocUrl(snapshot.getDocUrl());
            job.setTenantId(currentJob.getTenantId());
            job.setCreatedBy(currentJob.getCreatedBy());
            job.setCreatedAt(currentJob.getCreatedAt());
            job.setUpdatedAt(currentJob.getUpdatedAt());
            job.setDeleted(currentJob.getDeleted());
            return job;
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "作业版本快照解析失败");
        }
    }

    private static boolean samePublishDefinition(FlinkJob current, FlinkJob snapshot) {
        return java.util.Objects.equals(current.getJobName(), snapshot.getJobName())
                && java.util.Objects.equals(current.getJobGroup(), snapshot.getJobGroup())
                && java.util.Objects.equals(current.getJobType(), snapshot.getJobType())
                && java.util.Objects.equals(current.getRuntimeMode(), snapshot.getRuntimeMode())
                && java.util.Objects.equals(current.getSubmitType(), snapshot.getSubmitType())
                && java.util.Objects.equals(current.getExecutionMode(), snapshot.getExecutionMode())
                && java.util.Objects.equals(current.getClusterId(), snapshot.getClusterId())
                && java.util.Objects.equals(current.getAlertChannelId(), snapshot.getAlertChannelId())
                && java.util.Objects.equals(current.getAlertRule(), snapshot.getAlertRule())
                && java.util.Objects.equals(current.getContent(), snapshot.getContent())
                && java.util.Objects.equals(current.getMainClass(), snapshot.getMainClass())
                && java.util.Objects.equals(current.getArgs(), snapshot.getArgs())
                && java.util.Objects.equals(current.getFlinkConfig(), snapshot.getFlinkConfig())
                && java.util.Objects.equals(current.getParallelism(), snapshot.getParallelism())
                && java.util.Objects.equals(current.getSavepointPath(), snapshot.getSavepointPath())
                && java.util.Objects.equals(current.getApplicationImage(), snapshot.getApplicationImage())
                && java.util.Objects.equals(current.getJarUri(), snapshot.getJarUri())
                && java.util.Objects.equals(current.getDependencyRefs(), snapshot.getDependencyRefs())
                && java.util.Objects.equals(current.getDescription(), snapshot.getDescription())
                && java.util.Objects.equals(current.getJobTags(), snapshot.getJobTags())
                && java.util.Objects.equals(current.getDocUrl(), snapshot.getDocUrl());
    }

    /**
     * Flink 作业运行状态映射函数
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

    public List<FlinkJobExecution> listExecutions(Long jobId) {
        FlinkJob job = getRequired(jobId);
        if (StringUtils.hasText(job.getFlinkJobId()) && job.getClusterId() != null) {
            syncJobStatus(job);
        }
        int retention = systemDefaultsService.jobExecutionRetention(job.getTenantId());
        List<FlinkJobExecution> executions = flinkJobExecutionService.listByJob(
                job.getId(),
                job.getTenantId(),
                retention
        );
        return syncActiveExecutions(job, executions, retention);
    }

    private List<FlinkJobExecution> syncActiveExecutions(FlinkJob job, List<FlinkJobExecution> executions, int retention) {
        if (executions == null || executions.isEmpty() || job.getClusterId() == null) {
            return executions;
        }
        FlinkCluster cluster;
        try {
            cluster = flinkClusterService.getRequiredForTenant(job.getClusterId(), job.getTenantId());
        } catch (Exception e) {
            log.warn("Failed to resolve Flink cluster for job executions sync, jobId={}: {}", job.getId(), e.getMessage());
            return executions;
        }
        boolean changed = false;
        for (FlinkJobExecution execution : executions) {
            if (!isActiveExecutionStatus(execution.getStatus()) || !StringUtils.hasText(execution.getFlinkJobId())) {
                continue;
            }
            try {
                String mappedState;
                String errorLog = null;
                if (isK8sApplicationCluster(cluster)) {
                    K8sOperatorApplicationSubmitter.OperatorStatus status = k8sOperatorApplicationSubmitter.getStatus(cluster, execution.getFlinkJobId());
                    if (status == null || !StringUtils.hasText(status.status())) {
                        continue;
                    }
                    mappedState = status.status();
                    errorLog = status.errorLog();
                } else {
                    FlinkRestClient restClient = new FlinkRestClient(cluster.getAddress(), connectTimeoutMs, readTimeoutMs);
                    String flinkState = restClient.getJobState(execution.getFlinkJobId());
                    if (!StringUtils.hasText(flinkState)) {
                        continue;
                    }
                    mappedState = mapFlinkStatus(flinkState);
                    errorLog = "FAILED".equals(mappedState) ? restClient.getJobExceptionLog(execution.getFlinkJobId()) : null;
                }
                if (mappedState.equalsIgnoreCase(execution.getStatus())) {
                    continue;
                }
                flinkJobExecutionService.syncStatus(execution.getId(), mappedState, errorLog);
                if (execution.getId().equals(job.getCurrentExecutionId())) {
                    boolean statusChanged = !mappedState.equals(job.getStatus());
                    boolean clearCurrentFlinkJobId = shouldClearCurrentFlinkJobId(mappedState, job.getFlinkJobId());
                    if (statusChanged || clearCurrentFlinkJobId) {
                        job.setStatus(mappedState);
                        if (clearCurrentFlinkJobId) {
                            job.setFlinkJobId(null);
                        }
                        this.updateById(job);
                    }
                }
                changed = true;
            } catch (Exception e) {
                log.warn("Failed to sync Flink execution status, executionId={}, flinkJobId={}: {}",
                        execution.getId(), execution.getFlinkJobId(), e.getMessage());
            }
        }
        return changed ? flinkJobExecutionService.listByJob(job.getId(), job.getTenantId(), retention) : executions;
    }

    private static boolean isActiveExecutionStatus(String status) {
        return "CREATED".equalsIgnoreCase(status)
                || "SUBMITTING".equalsIgnoreCase(status)
                || "RUNNING".equalsIgnoreCase(status);
    }

    private static boolean shouldClearCurrentFlinkJobId(String status, String flinkJobId) {
        return StringUtils.hasText(flinkJobId) && isTerminalJobStatus(status);
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

    private static boolean isK8sApplicationJob(FlinkJob job) {
        return "K8S_APPLICATION".equalsIgnoreCase(job.getSubmitType())
                || "k8s-application".equalsIgnoreCase(job.getExecutionMode());
    }

    private static boolean isK8sApplicationCluster(FlinkCluster cluster) {
        return cluster != null
                && "kubernetes".equalsIgnoreCase(cluster.getClusterType())
                && "application".equalsIgnoreCase(cluster.getDeploymentMode());
    }

}
