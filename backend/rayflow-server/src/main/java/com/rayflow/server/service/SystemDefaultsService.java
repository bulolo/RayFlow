package com.rayflow.server.service;

import com.rayflow.server.model.entity.Tenant;
import com.rayflow.server.model.request.system.SystemDefaultsRequest;
import com.rayflow.server.model.response.system.SystemDefaultsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SystemDefaultsService {

    public static final int DEFAULT_PARALLELISM = 1;
    public static final int DEFAULT_SAVEPOINT_RETENTION = 5;
    public static final int DEFAULT_JOB_VERSION_RETENTION = 5;
    public static final int DEFAULT_JOB_EXECUTION_RETENTION = 10;
    public static final boolean DEFAULT_FAILURE_ALERT_ENABLED = true;

    private final TenantAccessService tenantAccessService;
    private final TenantService tenantService;

    public SystemDefaultsResponse getCurrentTenantDefaults() {
        return SystemDefaultsResponse.from(tenantAccessService.requireCurrentTenant());
    }

    public SystemDefaultsResponse updateCurrentTenantDefaults(SystemDefaultsRequest request) {
        Tenant tenant = tenantAccessService.requireCurrentTenant();
        tenant.setDefaultParallelism(normalize(request.getDefaultParallelism(), DEFAULT_PARALLELISM));
        tenant.setSavepointRetention(normalize(request.getSavepointRetention(), DEFAULT_SAVEPOINT_RETENTION));
        tenant.setJobVersionRetention(normalize(request.getJobVersionRetention(), DEFAULT_JOB_VERSION_RETENTION));
        tenant.setJobExecutionRetention(normalize(request.getJobExecutionRetention(), DEFAULT_JOB_EXECUTION_RETENTION));
        tenant.setFailureAlertEnabled(request.getFailureAlertEnabled() == null ? DEFAULT_FAILURE_ALERT_ENABLED : request.getFailureAlertEnabled());
        tenantService.updateById(tenant);
        return SystemDefaultsResponse.from(tenant);
    }

    public int jobVersionRetention(Long tenantId) {
        Tenant tenant = tenantService.getRequiredById(tenantId);
        return normalize(tenant.getJobVersionRetention(), DEFAULT_JOB_VERSION_RETENTION);
    }

    public int savepointRetention(Long tenantId) {
        Tenant tenant = tenantService.getRequiredById(tenantId);
        return normalize(tenant.getSavepointRetention(), DEFAULT_SAVEPOINT_RETENTION);
    }

    public int jobExecutionRetention(Long tenantId) {
        Tenant tenant = tenantService.getRequiredById(tenantId);
        return normalize(tenant.getJobExecutionRetention(), DEFAULT_JOB_EXECUTION_RETENTION);
    }

    private static int normalize(Integer value, int fallback) {
        return value == null || value < 1 ? fallback : value;
    }
}
