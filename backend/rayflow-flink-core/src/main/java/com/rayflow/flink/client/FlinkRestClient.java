package com.rayflow.flink.client;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.util.Timeout;
import org.springframework.http.HttpMethod;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.Objects;
import java.util.Set;

/**
 * Flink REST API 客户端
 * 封装对 Flink JobManager REST API 的调用
 */
@Slf4j
@Data
public class FlinkRestClient {

    @Data
    public static class ClusterProbeResult {
        private final boolean healthy;
        private final String flinkVersion;
    }

    private final String baseUrl;
    private final RestTemplate restTemplate;

    public FlinkRestClient(String jobManagerUrl) {
        this(jobManagerUrl, 3000, 10000);
    }

    public FlinkRestClient(String jobManagerUrl, int connectTimeoutMs, int readTimeoutMs) {
        this.baseUrl = normalizeBaseUrl(jobManagerUrl);
        RequestConfig requestConfig = RequestConfig.custom()
                .setConnectTimeout(Timeout.ofMilliseconds(connectTimeoutMs))
                .setConnectionRequestTimeout(Timeout.ofMilliseconds(connectTimeoutMs))
                .setResponseTimeout(Timeout.ofMilliseconds(readTimeoutMs))
                .build();
        HttpComponentsClientHttpRequestFactory requestFactory = new HttpComponentsClientHttpRequestFactory(
                HttpClients.custom().setDefaultRequestConfig(requestConfig).build());
        this.restTemplate = new RestTemplate(requestFactory);
    }

    /**
     * 获取集群概览
     * GET /overview
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getOverview() {
        String url = baseUrl + "/overview";
        log.debug("Flink REST: GET {}", url);
        return restTemplate.getForObject(url, Map.class);
    }

    /**
     * 获取 UI 配置
     * GET /config
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getConfig() {
        String url = baseUrl + "/config";
        log.debug("Flink REST: GET {}", url);
        return restTemplate.getForObject(url, Map.class);
    }

    /**
     * 获取所有作业列表
     * GET /jobs/overview
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getJobsOverview() {
        String url = baseUrl + "/jobs/overview";
        log.debug("Flink REST: GET {}", url);
        return restTemplate.getForObject(url, Map.class);
    }

    /**
     * 获取作业详情
     * GET /jobs/:jobId
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getJobDetail(String jobId) {
        String url = baseUrl + "/jobs/" + jobId;
        log.debug("Flink REST: GET {}", url);
        return restTemplate.getForObject(url, Map.class);
    }

    /**
     * 获取作业状态，详情接口不可用时回退到 /jobs/overview
     */
    @SuppressWarnings("unchecked")
    public String getJobState(String jobId) {
        if (jobId == null || jobId.isBlank()) {
            return null;
        }
        try {
            Map<String, Object> detail = getJobDetail(jobId);
            String state = readString(detail == null ? null : detail.get("state"));
            if (state != null && !state.isBlank()) {
                return state;
            }
        } catch (Exception e) {
            log.debug("Flink REST: GET /jobs/{} failed, fallback to /jobs/overview: {}", jobId, e.getMessage());
        }
        Map<String, Object> overview = getJobsOverview();
        Object rawJobs = overview == null ? null : overview.get("jobs");
        if (rawJobs instanceof List<?> jobs) {
            for (Object item : jobs) {
                if (!(item instanceof Map<?, ?> map)) {
                    continue;
                }
                if (!Objects.equals(readString(map.get("jid")), jobId)) {
                    continue;
                }
                return readString(map.get("state"));
            }
        }
        return null;
    }

    /**
     * 获取作业异常日志
     * GET /jobs/:jobId/exceptions
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getJobExceptions(String jobId) {
        String url = baseUrl + "/jobs/" + jobId + "/exceptions";
        log.debug("Flink REST: GET {}", url);
        try {
            return restTemplate.getForObject(url, Map.class);
        } catch (Exception e) {
            log.warn("Failed to get Flink job exceptions from {}: {}", url, e.getMessage());
            return Map.of();
        }
    }

    /**
     * 获取作业完整异常日志
     */
    public String getJobExceptionLog(String jobId) {
        Map<String, Object> exceptions = getJobExceptions(jobId);
        if (exceptions == null || exceptions.isEmpty()) {
            return null;
        }
        StringBuilder result = new StringBuilder();

        Object root = exceptions.get("root-exception");
        if (root instanceof String value && !value.isBlank()) {
            return value.trim();
        }

        Object all = exceptions.get("all-exceptions");
        if (all instanceof List<?> rows) {
            int index = 1;
            for (Object row : rows) {
                String text = formatExceptionRow(row);
                if (text.isBlank()) {
                    continue;
                }
                if (!(row instanceof Map<?, ?> map)) {
                    result.append("[").append(index++).append("] ").append(text).append("\n\n");
                    continue;
                }
                result.append("[").append(index++).append("]\n").append(text).append("\n\n");
            }
        }

        String log = result.toString().trim();
        return log.isBlank() ? null : log;
    }

    private static String formatExceptionRow(Object row) {
        if (!(row instanceof Map<?, ?> map)) {
            return row == null ? "" : String.valueOf(row).trim();
        }
        StringBuilder result = new StringBuilder();
        Object exception = map.get("exception");
        if (exception instanceof String value && !value.isBlank()) {
            result.append(value.trim());
        }
        Object stackTrace = map.get("stack-trace");
        if (stackTrace instanceof String value && !value.isBlank()) {
            if (!result.isEmpty()) {
                result.append('\n');
            }
            result.append(value.trim());
        }
        return result.toString();
    }

    /**
     * 取消作业
     * PATCH /jobs/:jobId
     */
    public void cancelJob(String jobId) {
        String url = baseUrl + "/jobs/" + jobId;
        log.info("Flink REST: PATCH {} (cancel)", url);
        restTemplate.exchange(url, HttpMethod.PATCH, null, Void.class);
    }

    /**
     * 触发 Savepoint
     * POST /jobs/:jobId/savepoints
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> triggerSavepoint(String jobId, String targetDir, boolean cancelJob) {
        String url = baseUrl + "/jobs/" + jobId + "/savepoints";
        Map<String, Object> body = new LinkedHashMap<>();
        if (targetDir != null && !targetDir.isBlank()) {
            body.put("target-directory", targetDir);
        }
        body.put("cancel-job", cancelJob);
        log.info("Flink REST: POST {} (savepoint)", url);
        return restTemplate.postForObject(url, body, Map.class);
    }

    /**
     * 获取作业 Checkpoint 详情
     * GET /jobs/:jobId/checkpoints
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getJobCheckpoints(String jobId) {
        String url = baseUrl + "/jobs/" + jobId + "/checkpoints";
        log.debug("Flink REST: GET {}", url);
        return restTemplate.getForObject(url, Map.class);
    }

    /**
     * 获取 TaskManager 列表
     * GET /taskmanagers
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getTaskManagers() {
        String url = baseUrl + "/taskmanagers";
        log.debug("Flink REST: GET {}", url);
        return restTemplate.getForObject(url, Map.class);
    }

    /**
     * 健康检查
     */
    public boolean isHealthy() {
        try {
            getOverview();
            return true;
        } catch (Exception e) {
            log.warn("Flink cluster unreachable: {}", baseUrl);
            return false;
        }
    }

    /**
     * 探测集群健康状态与版本号
     */
    public ClusterProbeResult probeCluster() {
        try {
            Map<String, Object> overview = getOverview();
            String flinkVersion = readString(overview.get("flink-version"));
            if (flinkVersion == null || flinkVersion.isBlank()) {
                Map<String, Object> config = getConfig();
                flinkVersion = readString(config.get("flink-version"));
            }
            return new ClusterProbeResult(true, flinkVersion);
        } catch (Exception e) {
            log.warn("Flink cluster probe failed: {}", baseUrl);
            return new ClusterProbeResult(false, null);
        }
    }

    /**
     * 上传 JAR 包
     * POST /jars/upload
     */
    @SuppressWarnings("unchecked")
    public String uploadJar(java.io.File jarFile) {
        String url = baseUrl + "/jars/upload";
        log.info("Flink REST: POST {} (upload jar={})", url, jarFile.getName());
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.setContentType(org.springframework.http.MediaType.MULTIPART_FORM_DATA);
        org.springframework.util.MultiValueMap<String, Object> body = new org.springframework.util.LinkedMultiValueMap<>();
        body.add("jarfile", new org.springframework.core.io.FileSystemResource(jarFile));
        org.springframework.http.HttpEntity<org.springframework.util.MultiValueMap<String, Object>> requestEntity = 
                new org.springframework.http.HttpEntity<>(body, headers);
        Map<String, Object> response = restTemplate.postForObject(url, requestEntity, Map.class);
        if (response != null && "success".equalsIgnoreCase(String.valueOf(response.get("status")))) {
            String filename = (String) response.get("filename");
            return new java.io.File(filename).getName();
        }
        throw new RuntimeException("Failed to upload JAR to Flink JobManager: " + response);
    }

    /**
     * 运行已上传的 JAR 包
     * POST /jars/:jarId/run
     */
    @SuppressWarnings("unchecked")
    public String runJar(String jarId, String entryClass, String programArgs, Integer parallelism, String savepointPath) {
        return runJar(jarId, entryClass, programArgs, parallelism, savepointPath, List.of());
    }

    @SuppressWarnings("unchecked")
    public String runJar(String jarId, String entryClass, String programArgs, Integer parallelism, String savepointPath, List<String> classpaths) {
        return runJar(jarId, entryClass, programArgs, parallelism, savepointPath, classpaths, Map.of());
    }

    @SuppressWarnings("unchecked")
    public String runJar(
            String jarId,
            String entryClass,
            String programArgs,
            Integer parallelism,
            String savepointPath,
            List<String> classpaths,
            Map<String, String> flinkConfiguration
    ) {
        String url = baseUrl + "/jars/" + jarId + "/run";
        log.info("Flink REST: POST {} (run jar)", url);
        Map<String, Object> body = new LinkedHashMap<>();
        if (entryClass != null && !entryClass.isBlank()) {
            body.put("entryClass", entryClass);
        }
        if (programArgs != null && !programArgs.isBlank()) {
            body.put("programArgsList", splitProgramArgs(programArgs));
        }
        if (parallelism != null) {
            body.put("parallelism", parallelism);
        }
        if (savepointPath != null && !savepointPath.isBlank()) {
            body.put("savepointPath", savepointPath);
        }
        if (classpaths != null && !classpaths.isEmpty()) {
            body.put("classpaths", classpaths);
        }
        if (flinkConfiguration != null && !flinkConfiguration.isEmpty()) {
            body.put("flinkConfiguration", flinkConfiguration);
        }
        Map<String, Object> response = restTemplate.postForObject(url, body, Map.class);
        if (response != null && response.containsKey("jobid")) {
            return (String) response.get("jobid");
        }
        throw new RuntimeException("Failed to run JAR on Flink JobManager: " + response);
    }

    @SuppressWarnings("unchecked")
    public String findLatestJobIdByName(String jobName, long notBeforeEpochMillis, long timeoutMs) {
        long deadline = System.currentTimeMillis() + timeoutMs;
        while (System.currentTimeMillis() < deadline) {
            Map<String, Object> overview = getJobsOverview();
            Object rawJobs = overview == null ? null : overview.get("jobs");
            if (rawJobs instanceof List<?> jobs) {
                String jobId = jobs.stream()
                        .filter(Map.class::isInstance)
                        .map(item -> (Map<String, Object>) item)
                        .filter(item -> Objects.equals(readString(item.get("name")), jobName))
                        .filter(item -> readLong(item.get("start-time")) >= notBeforeEpochMillis)
                        .max(Comparator.comparingLong(item -> readLong(item.get("start-time"))))
                        .map(item -> readString(item.get("jid")))
                        .orElse(null);
                if (jobId != null && !jobId.isBlank()) {
                    return jobId;
                }
            }
            try {
                Thread.sleep(1000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    public Set<String> listJobIdsByName(String jobName) {
        Set<String> jobIds = new HashSet<>();
        Map<String, Object> overview = getJobsOverview();
        Object rawJobs = overview == null ? null : overview.get("jobs");
        if (rawJobs instanceof List<?> jobs) {
            for (Object item : jobs) {
                if (!(item instanceof Map<?, ?> map)) {
                    continue;
                }
                if (!Objects.equals(readString(map.get("name")), jobName)) {
                    continue;
                }
                String jobId = readString(map.get("jid"));
                if (jobId != null && !jobId.isBlank()) {
                    jobIds.add(jobId);
                }
            }
        }
        return jobIds;
    }

    public String waitForNewJobIdByName(String jobName, Set<String> existingJobIds, long timeoutMs) {
        long deadline = System.currentTimeMillis() + timeoutMs;
        while (System.currentTimeMillis() < deadline) {
            Set<String> currentJobIds = listJobIdsByName(jobName);
            for (String jobId : currentJobIds) {
                if (!existingJobIds.contains(jobId)) {
                    return jobId;
                }
            }
            try {
                Thread.sleep(1000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        return null;
    }

    private static List<String> splitProgramArgs(String programArgs) {
        List<String> args = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean singleQuoted = false;
        boolean doubleQuoted = false;
        for (int i = 0; i < programArgs.length(); i++) {
            char ch = programArgs.charAt(i);
            if (ch == '\'' && !doubleQuoted) {
                singleQuoted = !singleQuoted;
            } else if (ch == '"' && !singleQuoted) {
                doubleQuoted = !doubleQuoted;
            } else if (Character.isWhitespace(ch) && !singleQuoted && !doubleQuoted) {
                if (!current.isEmpty()) {
                    args.add(current.toString());
                    current.setLength(0);
                }
            } else {
                current.append(ch);
            }
        }
        if (!current.isEmpty()) {
            args.add(current.toString());
        }
        return args;
    }

    private static String normalizeBaseUrl(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Flink JobManager URL is required");
        }
        URI uri = URI.create(value.trim());
        String scheme = uri.getScheme();
        if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
            throw new IllegalArgumentException("Flink JobManager URL must use http or https");
        }
        if (uri.getHost() == null || uri.getHost().isBlank()) {
            throw new IllegalArgumentException("Flink JobManager URL must include a host");
        }
        if (uri.getUserInfo() != null) {
            throw new IllegalArgumentException("Flink JobManager URL must not include user info");
        }
        String normalized = uri.toString();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private static String readString(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static long readLong(Object value) {
        if (value == null) {
            return Long.MIN_VALUE;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(value).trim());
        } catch (NumberFormatException ignored) {
            return Long.MIN_VALUE;
        }
    }
}
