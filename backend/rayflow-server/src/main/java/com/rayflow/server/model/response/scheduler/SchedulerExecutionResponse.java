package com.rayflow.server.model.response.scheduler;

import com.rayflow.server.model.entity.SchedulerExecution;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class SchedulerExecutionResponse {

    private Long id;
    private Long workflowId;
    private Long versionId;
    private String triggerType;
    private String status;
    private String message;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private LocalDateTime createdAt;

    public static SchedulerExecutionResponse from(SchedulerExecution execution) {
        return SchedulerExecutionResponse.builder()
                .id(execution.getId())
                .workflowId(execution.getWorkflowId())
                .versionId(execution.getVersionId())
                .triggerType(execution.getTriggerType())
                .status(execution.getStatus())
                .message(execution.getMessage())
                .startedAt(execution.getStartedAt())
                .finishedAt(execution.getFinishedAt())
                .createdAt(execution.getCreatedAt())
                .build();
    }
}
