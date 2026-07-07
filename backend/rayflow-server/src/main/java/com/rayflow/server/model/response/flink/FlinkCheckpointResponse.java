package com.rayflow.server.model.response.flink;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class FlinkCheckpointResponse {

    private String flinkJobId;
    private Map<String, Object> counts;
    private Map<String, Object> summary;
    private Map<String, Object> latest;
    private List<Map<String, Object>> history;
    private Map<String, Object> raw;

    @SuppressWarnings("unchecked")
    public static FlinkCheckpointResponse from(String flinkJobId, Map<String, Object> raw) {
        return FlinkCheckpointResponse.builder()
                .flinkJobId(flinkJobId)
                .counts(readMap(raw, "counts"))
                .summary(readMap(raw, "summary"))
                .latest(readMap(raw, "latest"))
                .history(readList(raw, "history"))
                .raw(raw)
                .build();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> readMap(Map<String, Object> raw, String key) {
        Object value = raw == null ? null : raw.get(key);
        return value instanceof Map<?, ?> ? (Map<String, Object>) value : Map.of();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> readList(Map<String, Object> raw, String key) {
        Object value = raw == null ? null : raw.get(key);
        return value instanceof List<?> ? (List<Map<String, Object>>) value : List.of();
    }
}
