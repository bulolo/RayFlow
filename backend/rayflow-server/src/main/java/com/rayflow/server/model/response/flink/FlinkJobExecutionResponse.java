package com.rayflow.server.model.response.flink;

import com.rayflow.server.model.entity.FlinkJobExecution;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class FlinkJobExecutionResponse {

    private Long id;
    private Long jobId;
    private Long versionId;
    private String versionName;
    private String flinkJobId;
    private String status;
    private String submitPayload;
    private String errorLog;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Long duration;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static FlinkJobExecutionResponse from(FlinkJobExecution execution) {
        if (execution == null) return null;
        return FlinkJobExecutionResponse.builder()
                .id(execution.getId())
                .jobId(execution.getJobId())
                .versionId(execution.getVersionId())
                .versionName(execution.getVersionName())
                .flinkJobId(execution.getFlinkJobId())
                .status(execution.getStatus())
                .submitPayload(execution.getSubmitPayload())
                .errorLog(execution.getErrorLog())
                .startTime(execution.getStartTime())
                .endTime(execution.getEndTime())
                .duration(execution.getDuration())
                .createdAt(execution.getCreatedAt())
                .updatedAt(execution.getUpdatedAt())
                .build();
    }
}
