package com.rayflow.server.model.response.tenant;

import com.rayflow.server.model.entity.Tenant;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class TenantResponse {

    private Long id;
    private String tenantName;
    private String tenantSlug;
    private String status;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static TenantResponse from(Tenant tenant) {
        return TenantResponse.builder()
                .id(tenant.getId())
                .tenantName(tenant.getTenantName())
                .tenantSlug(tenant.getTenantSlug())
                .status(tenant.getStatus())
                .description(tenant.getDescription())
                .createdAt(tenant.getCreatedAt())
                .updatedAt(tenant.getUpdatedAt())
                .build();
    }
}
