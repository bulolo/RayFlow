package com.rayflow.server.service;

import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.model.entity.Tenant;
import com.rayflow.server.model.entity.User;
import com.rayflow.server.model.enums.PlatformRole;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
@RequiredArgsConstructor
public class TenantAccessService {

    public static final String TENANT_HEADER = "X-Tenant-Slug";

    private final UserService userService;
    private final TenantService tenantService;

    public User requireCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        User user = userService.findActiveByUsername(authentication.getName());
        if (user == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        return user;
    }

    public void requirePlatformAdmin() {
        User user = requireCurrentUser();
        if (!PlatformRole.SUPER_ADMIN.equalsIgnoreCase(user.getRole())) {
            throw new BusinessException(ResultCode.FORBIDDEN.getCode(), "仅超级管理员可执行当前操作");
        }
    }

    public Tenant requireCurrentTenant() {
        User user = requireCurrentUser();
        HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes()).getRequest();
        return tenantService.resolveTenantForUser(user.getId(), request.getHeader(TENANT_HEADER));
    }

    public Long requireCurrentTenantId() {
        return requireCurrentTenant().getId();
    }
}
