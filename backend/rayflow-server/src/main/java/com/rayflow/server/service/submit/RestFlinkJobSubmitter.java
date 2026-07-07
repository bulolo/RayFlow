package com.rayflow.server.service.submit;

import com.rayflow.flink.client.FlinkRestClient;
import com.rayflow.flink.client.FlinkErrorParser;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.model.entity.FlinkCluster;
import com.rayflow.server.model.entity.FlinkJob;
import com.rayflow.server.service.FlinkJarResourceService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class RestFlinkJobSubmitter implements FlinkJobSubmitter {

    private final SqlRunnerJarResolver sqlRunnerJarResolver;
    private final S3JarResolver s3JarResolver;
    private final FlinkJarResourceService flinkJarResourceService;
    private final ObjectMapper objectMapper;

    @Value("${rayflow.flink.rest-connect-timeout-ms:3000}")
    private int connectTimeoutMs;

    @Value("${rayflow.flink.rest-read-timeout-ms:120000}")
    private int readTimeoutMs;

    @Value("${rayflow.flink.rest-submit-read-timeout-ms:300000}")
    private int submitReadTimeoutMs;

    @Override
    public String submit(FlinkJob job, FlinkCluster cluster) {
        FlinkRestClient probeClient = new FlinkRestClient(cluster.getAddress(), connectTimeoutMs, readTimeoutMs);
        if (!probeClient.isHealthy()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Flink 运行时连接失败，请检查运行时地址或状态: " + cluster.getAddress());
        }
        FlinkRestClient restClient = new FlinkRestClient(cluster.getAddress(), connectTimeoutMs, submitReadTimeoutMs);

        if ("JAR".equalsIgnoreCase(job.getJobType())) {
            JarFileRef jarFileRef = resolveJobJar(job);
            try {
                log.info("REST Submitter: Submitting real JAR job to Flink: id={}, name={}, file={}", job.getId(), job.getJobName(), jarFileRef.file().getAbsolutePath());
                String jarId = restClient.uploadJar(jarFileRef.file());
                return restClient.runJar(jarId, job.getMainClass(), job.getArgs(), job.getParallelism(), job.getSavepointPath(), List.of(), parseFlinkConfiguration(job));
            } catch (Exception e) {
                log.error("Failed to upload/run JAR job on Flink cluster: {}", e.getMessage());
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Flink 物理提交 JAR 失败: " + FlinkErrorParser.parse(e), e);
            } finally {
                jarFileRef.cleanup();
            }
        } else if ("SQL".equalsIgnoreCase(job.getJobType())) {
            if (isBlank(job.getContent())) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "SQL 作业内容不能为空");
            }
            return submitSqlJob(restClient, job);
        } else {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "不支持的 Flink 作业类型: " + job.getJobType());
        }
    }

    private JarFileRef resolveJobJar(FlinkJob job) {
        if (isBlank(job.getJarUri())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "JAR 作业包不能为空，请选择资源中心 JAR 或填写 S3 JAR URI");
        }
        String jarUri = job.getJarUri().trim();
        if (!jarUri.startsWith("s3://")) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "JAR 作业包必须使用 s3:// URI");
        }
        Path tempFile = s3JarResolver.downloadToTempFile(jarUri);
        return new JarFileRef(tempFile.toFile(), true);
    }

    private String submitSqlJob(FlinkRestClient restClient, FlinkJob job) {
        Set<String> existingJobIds = restClient.listJobIdsByName(job.getJobName());
        try {
            return runSqlRunner(restClient, job);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            String recoveredJobId = recoverSubmittedJobId(restClient, job.getJobName(), existingJobIds, e);
            if (recoveredJobId != null) {
                return recoveredJobId;
            }
            log.error("Failed to submit SQL job on Flink cluster: {}", e.getMessage());
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Flink 运行作业提交失败: " + FlinkErrorParser.parse(e), e);
        }
    }

    private String runSqlRunner(FlinkRestClient restClient, FlinkJob job) {
        File runnerJar = sqlRunnerJarResolver.resolve();
        log.info("REST Submitter: Submitting SQL job to Flink via RayFlow SQL runner: id={}, name={}, runner={}", job.getId(), job.getJobName(), runnerJar.getAbsolutePath());
        String jarId = restClient.uploadJar(runnerJar);
        String sqlBase64 = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(job.getContent().getBytes(StandardCharsets.UTF_8));
        String jobNameBase64 = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(job.getJobName().getBytes(StandardCharsets.UTF_8));
        String programArgs = "--sql-base64 " + sqlBase64
                + " --job-name-base64 " + jobNameBase64
                + " --parallelism " + (job.getParallelism() == null ? 1 : job.getParallelism());
        if (!isBlank(job.getArgs())) {
            programArgs += " " + job.getArgs().trim();
        }
        List<String> classpaths = flinkJarResourceService.resolveActiveStorageUrisForTenant(job.getDependencyRefs(), job.getTenantId());
        if (!classpaths.isEmpty()) {
            log.info("REST Submitter: adding SQL job dependency classpaths, jobId={}, count={}", job.getId(), classpaths.size());
        }
        return restClient.runJar(
                jarId,
                "com.rayflow.flink.sqlrunner.RayFlowSqlRunner",
                programArgs,
                job.getParallelism(),
                job.getSavepointPath(),
                classpaths,
                parseFlinkConfiguration(job)
        );
    }

    private Map<String, String> parseFlinkConfiguration(FlinkJob job) {
        String rawConfig = job.getFlinkConfig();
        if (isBlank(rawConfig) || "{}".equals(rawConfig.trim())) {
            return Map.of();
        }
        try {
            Map<String, Object> raw = objectMapper.readValue(rawConfig, new TypeReference<>() {
            });
            Map<String, String> config = new LinkedHashMap<>();
            raw.forEach((key, value) -> {
                if (key != null && !key.isBlank() && value != null) {
                    config.put(key, String.valueOf(value));
                }
            });
            return config;
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Flink 配置必须是 JSON 对象: " + e.getMessage());
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private record JarFileRef(File file, boolean temporary) {
        private void cleanup() {
            if (!temporary) {
                return;
            }
            try {
                Files.deleteIfExists(file.toPath());
            } catch (Exception ignored) {
            }
        }
    }

    private String recoverSubmittedJobId(FlinkRestClient restClient, String jobName, Set<String> existingJobIds, Exception error) {
        try {
            String recoveredJobId = restClient.waitForNewJobIdByName(jobName, existingJobIds, Math.max(submitReadTimeoutMs, 30000));
            if (recoveredJobId != null && !recoveredJobId.isBlank()) {
                log.warn(
                        "Recovered SQL job after submit callback error. jobName={}, flinkJobId={}, reason={}",
                        jobName,
                        recoveredJobId,
                        error.getMessage()
                );
                return recoveredJobId;
            }
        } catch (Exception recoverError) {
            log.warn("Failed to recover submitted SQL job by name. jobName={}, reason={}", jobName, recoverError.getMessage());
        }
        return null;
    }
}
