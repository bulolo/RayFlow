package com.rayflow.server.model.response.scheduler;

import com.rayflow.server.model.entity.SchedulerWorkflow;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class SchedulerWorkflowResponse {

    private Long id;
    private String workflowName;
    private String description;
    private String cron;
    private String period;
    private String timezone;
    private String status;
    private String executionMode;
    private String failureStrategy;
    private String concurrentPolicy;
    private Long alertChannelId;
    private Integer nodeCount;
    private String latestVersion;
    private String latestExecutionStatus;
    private LocalDateTime lastRunTime;
    private LocalDateTime nextRunTime;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static SchedulerWorkflowResponse from(SchedulerWorkflow workflow, int nodeCount, String latestVersion, String latestExecutionStatus) {
        return SchedulerWorkflowResponse.builder()
                .id(workflow.getId())
                .workflowName(workflow.getWorkflowName())
                .description(workflow.getDescription())
                .cron(workflow.getCron())
                .period(workflow.getPeriod())
                .timezone(workflow.getTimezone())
                .status(workflow.getStatus())
                .executionMode(workflow.getExecutionMode())
                .failureStrategy(workflow.getFailureStrategy())
                .concurrentPolicy(workflow.getConcurrentPolicy())
                .alertChannelId(workflow.getAlertChannelId())
                .nodeCount(nodeCount)
                .latestVersion(latestVersion)
                .latestExecutionStatus(latestExecutionStatus)
                .lastRunTime(workflow.getLastRunTime())
                .nextRunTime(workflow.getNextRunTime())
                .createdAt(workflow.getCreatedAt())
                .updatedAt(workflow.getUpdatedAt())
                .build();
    }
}
