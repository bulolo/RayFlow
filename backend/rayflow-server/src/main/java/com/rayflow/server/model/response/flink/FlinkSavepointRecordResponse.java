package com.rayflow.server.model.response.flink;

import com.rayflow.server.model.entity.FlinkSavepoint;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class FlinkSavepointRecordResponse {

    private Long id;
    private Long jobId;
    private String jobName;
    private String flinkJobId;
    private String requestId;
    private String location;
    private String targetDirectory;
    private Boolean cancelJob;
    private String status;
    private String triggerMessage;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static FlinkSavepointRecordResponse from(FlinkSavepoint savepoint) {
        return FlinkSavepointRecordResponse.builder()
                .id(savepoint.getId())
                .jobId(savepoint.getJobId())
                .jobName(savepoint.getJobName())
                .flinkJobId(savepoint.getFlinkJobId())
                .requestId(savepoint.getRequestId())
                .location(savepoint.getLocation())
                .targetDirectory(savepoint.getTargetDirectory())
                .cancelJob(savepoint.getCancelJob())
                .status(savepoint.getStatus())
                .triggerMessage(savepoint.getTriggerMessage())
                .createdAt(savepoint.getCreatedAt())
                .updatedAt(savepoint.getUpdatedAt())
                .build();
    }
}
