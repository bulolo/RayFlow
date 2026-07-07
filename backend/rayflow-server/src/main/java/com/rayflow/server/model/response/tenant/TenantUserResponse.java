package com.rayflow.server.model.response.tenant;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class TenantUserResponse {

    private Long id;
    private Long tenantId;
    private String username;
    private String nickname;
    private String email;
    private String role;
    private Integer status;
    private LocalDateTime lastLoginAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
