package com.rayflow.server.model.response.scheduler;

import com.rayflow.server.model.entity.SchedulerExecutionLog;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class SchedulerExecutionLogResponse {

    private Long id;
    private Long executionId;
    private Long workflowId;
    private Long nodeExecutionId;
    private String nodeKey;
    private String level;
    private String eventType;
    private String message;
    private LocalDateTime createdAt;

    public static SchedulerExecutionLogResponse from(SchedulerExecutionLog log) {
        return SchedulerExecutionLogResponse.builder()
                .id(log.getId())
                .executionId(log.getExecutionId())
                .workflowId(log.getWorkflowId())
                .nodeExecutionId(log.getNodeExecutionId())
                .nodeKey(log.getNodeKey())
                .level(log.getLevel())
                .eventType(log.getEventType())
                .message(log.getMessage())
                .createdAt(log.getCreatedAt())
                .build();
    }
}
