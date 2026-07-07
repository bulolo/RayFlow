package com.rayflow.server.model.response.scheduler;

import com.rayflow.server.model.entity.SchedulerWorkflowNode;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SchedulerNodeResponse {

    private Long id;
    private String nodeKey;
    private Long flinkJobId;
    private String jobName;
    private String jobType;
    private Integer maxRetries;
    private Integer retryInterval;
    private Integer timeoutMinutes;
    private String onTimeout;
    private Integer positionX;
    private Integer positionY;

    public static SchedulerNodeResponse from(SchedulerWorkflowNode node) {
        return SchedulerNodeResponse.builder()
                .id(node.getId())
                .nodeKey(node.getNodeKey())
                .flinkJobId(node.getFlinkJobId())
                .jobName(node.getJobName())
                .jobType(node.getJobType())
                .maxRetries(node.getMaxRetries())
                .retryInterval(node.getRetryInterval())
                .timeoutMinutes(node.getTimeoutMinutes())
                .onTimeout(node.getOnTimeout())
                .positionX(node.getPositionX())
                .positionY(node.getPositionY())
                .build();
    }
}
