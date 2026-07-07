package com.rayflow.server.model.response.flink;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class FlinkSavepointResponse {
    private Long recordId;
    private String requestId;
    private String location;
    private String status;
    private String flinkJobId;
    private String targetDirectory;
    private Boolean cancelJob;

    public static FlinkSavepointResponse from(
            Long recordId,
            String flinkJobId,
            String targetDirectory,
            boolean cancelJob,
            Map<String, Object> flinkResponse
    ) {
        return FlinkSavepointResponse.builder()
                .recordId(recordId)
                .requestId(readString(flinkResponse, "request-id"))
                .location(readString(flinkResponse, "location"))
                .status(readString(flinkResponse, "status"))
                .flinkJobId(flinkJobId)
                .targetDirectory(targetDirectory)
                .cancelJob(cancelJob)
                .build();
    }

    public static FlinkSavepointResponse from(
            String flinkJobId,
            String targetDirectory,
            boolean cancelJob,
            Map<String, Object> flinkResponse
    ) {
        return from(null, flinkJobId, targetDirectory, cancelJob, flinkResponse);
    }

    private static String readString(Map<String, Object> source, String key) {
        Object value = source == null ? null : source.get(key);
        return value == null ? null : String.valueOf(value);
    }
}
