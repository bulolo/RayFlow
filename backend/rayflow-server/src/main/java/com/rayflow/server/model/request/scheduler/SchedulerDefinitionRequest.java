package com.rayflow.server.model.request.scheduler;

import jakarta.validation.Valid;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class SchedulerDefinitionRequest {

    @Valid
    private List<SchedulerNodeRequest> nodes = new ArrayList<>();

    @Valid
    private List<SchedulerEdgeRequest> edges = new ArrayList<>();

    @Valid
    private List<SchedulerVariableRequest> variables = new ArrayList<>();
}
