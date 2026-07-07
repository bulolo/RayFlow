package com.rayflow.server.model.response.scheduler;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class SchedulerValidationResponse {

    private Boolean valid;
    private List<String> errors;
    private List<String> warnings;
}
