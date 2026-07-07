package com.rayflow.server.model.response.system;

import com.rayflow.server.model.entity.Tenant;
import com.rayflow.server.service.SystemDefaultsService;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SystemDefaultsResponse {

    private Integer defaultParallelism;
    private Integer savepointRetention;
    private Integer jobVersionRetention;
    private Integer jobExecutionRetention;
    private Boolean failureAlertEnabled;

    public static SystemDefaultsResponse from(Tenant tenant) {
        return SystemDefaultsResponse.builder()
                .defaultParallelism(defaultNumber(tenant.getDefaultParallelism(), SystemDefaultsService.DEFAULT_PARALLELISM))
                .savepointRetention(defaultNumber(tenant.getSavepointRetention(), SystemDefaultsService.DEFAULT_SAVEPOINT_RETENTION))
                .jobVersionRetention(defaultNumber(tenant.getJobVersionRetention(), SystemDefaultsService.DEFAULT_JOB_VERSION_RETENTION))
                .jobExecutionRetention(defaultNumber(tenant.getJobExecutionRetention(), SystemDefaultsService.DEFAULT_JOB_EXECUTION_RETENTION))
                .failureAlertEnabled(tenant.getFailureAlertEnabled() == null ? SystemDefaultsService.DEFAULT_FAILURE_ALERT_ENABLED : tenant.getFailureAlertEnabled())
                .build();
    }

    private static Integer defaultNumber(Integer value, int fallback) {
        return value == null || value < 1 ? fallback : value;
    }
}
