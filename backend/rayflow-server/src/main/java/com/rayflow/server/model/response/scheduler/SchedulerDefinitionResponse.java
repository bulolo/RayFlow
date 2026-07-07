package com.rayflow.server.model.response.scheduler;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class SchedulerDefinitionResponse {

    private SchedulerWorkflowResponse workflow;
    private List<SchedulerNodeResponse> nodes;
    private List<SchedulerEdgeResponse> edges;
    private List<SchedulerVariableResponse> variables;
}
