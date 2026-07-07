package com.rayflow.server.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

/**
 * 调用 rayflow-worker 容器的 HTTP API，提交和查询镜像构建任务。
 * Worker 以 Docker-in-Docker (DinD) 模式运行，完全不依赖宿主机 Docker Socket。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ImageBuildWorkerClient {

    private final ObjectMapper objectMapper;

    @Value("${rayflow.worker.url:http://worker:8090}")
    private String workerUrl;

    @Value("${rayflow.image-publish.timeout-seconds:900}")
    private long buildTimeoutSeconds;

    private static final int SUBMIT_TIMEOUT_SECONDS = 10;

    /**
     * 提交构建任务给 worker，立即返回（非阻塞）。
     *
     * @return taskId
     */
    public String submitBuild(BuildPayload payload) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("taskId", payload.taskId());
            body.put("registryUrl", payload.registryUrl());
            body.put("registryAuthority", payload.registryAuthority());
            body.put("namespaceName", payload.namespaceName());
            body.put("username", payload.username());
            body.put("password", payload.password());
            body.put("sqlContent", payload.sqlContent());
            body.put("jobName", payload.jobName());
            body.put("versionNo", payload.versionNo());
            body.put("flinkBaseImage", payload.flinkBaseImage());
            body.put("runnerJarBase64", payload.runnerJarBase64());
            body.put("insecureRegistry", payload.insecureRegistry());
            body.put("buildProxy", StringUtils.hasText(payload.buildProxy()) ? payload.buildProxy() : "");

            String json = objectMapper.writeValueAsString(body);

            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(SUBMIT_TIMEOUT_SECONDS))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(workerUrl + "/api/build"))
                    .timeout(Duration.ofSeconds(SUBMIT_TIMEOUT_SECONDS))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 202) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                        "Worker 拒绝构建任务: HTTP " + response.statusCode() + " " + response.body());
            }

            WorkerTaskResponse resp = objectMapper.readValue(response.body(), WorkerTaskResponse.class);
            log.info("[worker-client] submitted build task={} for job={} v{}", resp.getTaskId(), payload.jobName(), payload.versionNo());
            return resp.getTaskId();

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                    "无法连接镜像构建 Worker 服务，请确认 worker 容器已启动: " + e.getMessage(), e);
        }
    }

    /**
     * 查询构建任务状态。
     */
    public WorkerTaskResponse getTaskStatus(String taskId) {
        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(5))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(workerUrl + "/api/tasks/" + taskId))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 404) {
                return null;
            }
            if (response.statusCode() != 200) {
                log.warn("[worker-client] unexpected status {} for task={}", response.statusCode(), taskId);
                return null;
            }

            return objectMapper.readValue(response.body(), WorkerTaskResponse.class);

        } catch (Exception e) {
            log.warn("[worker-client] failed to get task status taskId={}: {}", taskId, e.getMessage());
            return null;
        }
    }

    /**
     * 检测 worker 服务是否可达。
     */
    public boolean isWorkerAvailable() {
        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(3))
                    .build();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(workerUrl + "/api/health"))
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() == 200;
        } catch (Exception e) {
            return false;
        }
    }

    // ── DTOs ────────────────────────────────────────────────────────────────

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class WorkerTaskResponse {
        private String taskId;
        private String status;       // PENDING | RUNNING | SUCCEEDED | FAILED
        private String imageUri;
        private String imageDigest;
        private String log;
        private String startedAt;
        private String finishedAt;
    }

    public record BuildPayload(
            String taskId,
            String registryUrl,
            String registryAuthority,
            String namespaceName,
            String username,
            String password,
            String sqlContent,
            String jobName,
            int versionNo,
            String flinkBaseImage,
            String runnerJarBase64,
            boolean insecureRegistry,
            String buildProxy
    ) {}
}
