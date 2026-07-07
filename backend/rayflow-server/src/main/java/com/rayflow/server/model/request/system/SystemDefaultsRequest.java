package com.rayflow.server.model.request.system;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class SystemDefaultsRequest {

    @Min(1)
    @Max(1024)
    private Integer defaultParallelism;

    @Min(1)
    @Max(1000)
    private Integer savepointRetention;

    @Min(1)
    @Max(1000)
    private Integer jobVersionRetention;

    @Min(1)
    @Max(5000)
    private Integer jobExecutionRetention;

    private Boolean failureAlertEnabled;
}
