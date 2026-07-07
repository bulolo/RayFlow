package com.rayflow.server.model.response.scheduler;

import com.rayflow.server.model.entity.SchedulerNodeExecution;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class SchedulerNodeExecutionResponse {

    private Long id;
    private Long executionId;
    private Long workflowId;
    private String nodeKey;
    private Long flinkJobId;
    private String flinkRuntimeJobId;
    private String status;
    private Integer retryIndex;
    private String message;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private LocalDateTime createdAt;

    public static SchedulerNodeExecutionResponse from(SchedulerNodeExecution execution) {
        return SchedulerNodeExecutionResponse.builder()
                .id(execution.getId())
                .executionId(execution.getExecutionId())
                .workflowId(execution.getWorkflowId())
                .nodeKey(execution.getNodeKey())
                .flinkJobId(execution.getFlinkJobId())
                .flinkRuntimeJobId(execution.getFlinkRuntimeJobId())
                .status(execution.getStatus())
                .retryIndex(execution.getRetryIndex())
                .message(execution.getMessage())
                .startedAt(execution.getStartedAt())
                .finishedAt(execution.getFinishedAt())
                .createdAt(execution.getCreatedAt())
                .build();
    }
}
