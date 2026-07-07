package com.rayflow.server.model.response.scheduler;

import com.rayflow.server.model.entity.SchedulerWorkflowVariable;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SchedulerVariableResponse {

    private Long id;
    private String variableKey;
    private String variableValue;

    public static SchedulerVariableResponse from(SchedulerWorkflowVariable variable) {
        return SchedulerVariableResponse.builder()
                .id(variable.getId())
                .variableKey(variable.getVariableKey())
                .variableValue(variable.getVariableValue())
                .build();
    }
}
