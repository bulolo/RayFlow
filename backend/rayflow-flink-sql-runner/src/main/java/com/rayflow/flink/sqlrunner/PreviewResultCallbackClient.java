package com.rayflow.flink.sqlrunner;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

final class PreviewResultCallbackClient {

    private static final String TOKEN_HEADER = "X-RayFlow-Preview-Token";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    void reportSuccess(
            String callbackUrl,
            String callbackToken,
            List<Map<String, Object>> data,
            List<PreviewResultColumn> columns,
            boolean truncated,
            String previewType
    ) {
        post(callbackUrl, callbackToken, Map.of(
                "success", true,
                "previewType", previewType == null ? "TABLE" : previewType,
                "columns", columns,
                "data", data,
                "truncated", truncated
        ));
    }

    void reportFailure(String callbackUrl, String callbackToken, String errorMessage) {
        post(callbackUrl, callbackToken, Map.of(
                "success", false,
                "errorMessage", errorMessage == null ? "preview failed" : errorMessage
        ));
    }

    private void post(String callbackUrl, String callbackToken, Map<String, Object> body) {
        try {
            String payload = objectMapper.writeValueAsString(body);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(callbackUrl))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .header(TOKEN_HEADER, callbackToken == null ? "" : callbackToken)
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            if (status < 200 || status >= 300) {
                throw new IllegalStateException("Preview callback failed: HTTP " + status + " " + response.body());
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to report preview result: " + e.getMessage(), e);
        }
    }
}
