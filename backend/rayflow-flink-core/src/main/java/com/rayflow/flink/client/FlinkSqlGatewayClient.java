package com.rayflow.flink.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Flink SQL Gateway REST API 客户端
 */
@Slf4j
public class FlinkSqlGatewayClient {

    private final String baseUrl;
    private final RestTemplate restTemplate;

    public FlinkSqlGatewayClient(String gatewayUrl) {
        this(gatewayUrl, 3000, 10000);
    }

    public FlinkSqlGatewayClient(String gatewayUrl, int connectTimeoutMs, int readTimeoutMs) {
        this.baseUrl = normalizeBaseUrl(gatewayUrl);
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeoutMs);
        requestFactory.setReadTimeout(readTimeoutMs);
        this.restTemplate = new RestTemplate(requestFactory);
    }

    /**
     * 探测 SQL Gateway 连通性
     */
    public boolean isHealthy() {
        String sessionHandle = null;
        try {
            sessionHandle = openSession("rayflow-health-check-" + System.currentTimeMillis());
            return true;
        } catch (Exception e) {
            log.warn("Flink SQL Gateway unreachable: {}", baseUrl);
            return false;
        } finally {
            if (sessionHandle != null && !sessionHandle.isBlank()) {
                closeSession(sessionHandle);
            }
        }
    }

    /**
     * 开启一个 SQL Gateway Session
     * POST /v1/sessions
     */
    @SuppressWarnings("unchecked")
    public String openSession(String sessionName) {
        String url = baseUrl + "/v1/sessions";
        Map<String, Object> body = new HashMap<>();
        body.put("sessionName", sessionName);
        log.info("Flink SQL Gateway: POST {} (open session={})", url, sessionName);
        Map<String, Object> response = restTemplate.postForObject(url, body, Map.class);
        if (response != null && response.containsKey("sessionHandle")) {
            return (String) response.get("sessionHandle");
        }
        throw new RuntimeException("Failed to open session on SQL Gateway: " + response);
    }

    /**
     * 执行 SQL 语句
     * POST /v1/sessions/:sessionHandle/statements
     */
    @SuppressWarnings("unchecked")
    public String executeStatement(String sessionHandle, String statement) {
        String url = baseUrl + "/v1/sessions/" + sessionHandle + "/statements";
        Map<String, Object> body = new HashMap<>();
        body.put("statement", statement);
        log.info("Flink SQL Gateway: POST {} (execute statement)", url);
        Map<String, Object> response = restTemplate.postForObject(url, body, Map.class);
        if (response != null && response.containsKey("operationHandle")) {
            return (String) response.get("operationHandle");
        }
        throw new RuntimeException("Failed to execute statement on SQL Gateway: " + response);
    }

    /**
     * 获取 Operation 的执行状态
     * GET /v1/sessions/:sessionHandle/operations/:operationHandle/status
     */
    @SuppressWarnings("unchecked")
    public String getOperationStatus(String sessionHandle, String operationHandle) {
        String url = baseUrl + "/v1/sessions/" + sessionHandle + "/operations/" + operationHandle + "/status";
        log.debug("Flink SQL Gateway: GET {}", url);
        Map<String, Object> response = restTemplate.getForObject(url, Map.class);
        if (response != null && response.containsKey("status")) {
            return (String) response.get("status");
        }
        throw new RuntimeException("Failed to get operation status from SQL Gateway: " + response);
    }

    /**
     * 当状态为 FINISHED 时，获取执行产生的结果并提取 Flink Job ID
     * GET /v1/sessions/:sessionHandle/operations/:operationHandle/result/0
     */
    @SuppressWarnings("unchecked")
    public String getExecutionJobId(String sessionHandle, String operationHandle) {
        String url = baseUrl + "/v1/sessions/" + sessionHandle + "/operations/" + operationHandle + "/result/0";
        log.info("Flink SQL Gateway: GET {} (get result for jobid)", url);
        Map<String, Object> response = restTemplate.getForObject(url, Map.class);
        if (response == null) {
            throw new RuntimeException("Failed to get result from SQL Gateway: response is null");
        }
        try {
            Map<String, Object> results = (Map<String, Object>) response.get("results");
            if (results != null) {
                List<Map<String, Object>> data = (List<Map<String, Object>>) results.get("data");
                if (data != null && !data.isEmpty()) {
                    Map<String, Object> row = data.get(0);
                    List<Object> fields = (List<Object>) row.get("fields");
                    if (fields != null && !fields.isEmpty()) {
                        return String.valueOf(fields.get(0));
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse Job ID from SQL Gateway result response: {}", e.getMessage());
        }
        throw new RuntimeException("Failed to extract Job ID from SQL Gateway result response: " + response);
    }

    /**
     * 获取执行结果（支持动态传入偏移 Token 用于分页拉取）
     * GET /v1/sessions/:sessionHandle/operations/:operationHandle/result/:token
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getExecutionResult(String sessionHandle, String operationHandle, String token) {
        String url = baseUrl + "/v1/sessions/" + sessionHandle + "/operations/" + operationHandle + "/result/" + token;
        log.debug("Flink SQL Gateway: GET {}", url);
        return restTemplate.getForObject(url, Map.class);
    }

    /**
     * 取消或删除当前执行 Operation (用于提前停止 SELECT 任务释放 Slot)
     * DELETE /v1/sessions/:sessionHandle/operations/:operationHandle
     */
    public void cancelOperation(String sessionHandle, String operationHandle) {
        String url = baseUrl + "/v1/sessions/" + sessionHandle + "/operations/" + operationHandle;
        log.info("Flink SQL Gateway: DELETE {} (cancel operation)", url);
        try {
            restTemplate.delete(url);
        } catch (Exception e) {
            log.warn("Failed to cancel operation {} on SQL Gateway: {}", operationHandle, e.getMessage());
        }
    }

    /**
     * 关闭指定的 Session
     * DELETE /v1/sessions/:sessionHandle
     */
    public void closeSession(String sessionHandle) {
        String url = baseUrl + "/v1/sessions/" + sessionHandle;
        log.info("Flink SQL Gateway: DELETE {}", url);
        try {
            restTemplate.delete(url);
        } catch (Exception e) {
            log.warn("Failed to close session {} on SQL Gateway: {}", sessionHandle, e.getMessage());
        }
    }

    private static String normalizeBaseUrl(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Flink SQL Gateway URL is required");
        }
        URI uri = URI.create(value.trim());
        String scheme = uri.getScheme();
        if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
            throw new IllegalArgumentException("Flink SQL Gateway URL must use http or https");
        }
        if (uri.getHost() == null || uri.getHost().isBlank()) {
            throw new IllegalArgumentException("Flink SQL Gateway URL must include a host");
        }
        String normalized = uri.toString();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }
}
