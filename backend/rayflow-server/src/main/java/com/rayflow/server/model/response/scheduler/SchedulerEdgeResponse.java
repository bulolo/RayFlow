package com.rayflow.server.model.response.scheduler;

import com.rayflow.server.model.entity.SchedulerWorkflowEdge;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SchedulerEdgeResponse {

    private Long id;
    private String fromNodeKey;
    private String toNodeKey;
    private String strategy;

    public static SchedulerEdgeResponse from(SchedulerWorkflowEdge edge) {
        return SchedulerEdgeResponse.builder()
                .id(edge.getId())
                .fromNodeKey(edge.getFromNodeKey())
                .toNodeKey(edge.getToNodeKey())
                .strategy(edge.getStrategy())
                .build();
    }
}
