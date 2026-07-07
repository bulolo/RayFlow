package com.rayflow.server.config;

import com.rayflow.server.model.entity.Tenant;
import com.rayflow.server.model.entity.TenantUser;
import com.rayflow.server.model.entity.User;
import com.rayflow.server.model.enums.PlatformRole;
import com.rayflow.server.model.enums.TenantRole;
import com.rayflow.server.service.TenantService;
import com.rayflow.server.service.TenantUserService;
import com.rayflow.server.service.UserService;
import com.rayflow.server.service.SystemDefaultsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@Order(20)
@RequiredArgsConstructor
public class BootstrapTenantInitializer implements ApplicationRunner {
    private final TenantService tenantService;
    private final TenantUserService tenantUserService;
    private final UserService userService;

    @Value("${rayflow.default-tenant.admin.username:}")
    private String defaultTenantAdminUsername;

    @Override
    public void run(ApplicationArguments args) {
        Tenant tenant = tenantService.lambdaQuery()
                .eq(Tenant::getTenantSlug, "default")
                .last("LIMIT 1")
                .one();

        if (tenant == null) {
            tenant = new Tenant();
            tenant.setTenantName("默认组织");
            tenant.setTenantSlug("default");
            tenant.setStatus("ACTIVE");
            tenant.setDescription("系统初始化默认组织");
            applyInitialDefaults(tenant);
            tenantService.save(tenant);
            log.info("Bootstrap default tenant created");
        }

        List<User> users = userService.list();
        for (User user : users) {
            if (isPlatformSuperAdmin(user)) {
                tenantUserService.lambdaUpdate()
                        .eq(TenantUser::getUserId, user.getId())
                        .remove();
                continue;
            }
            boolean exists = tenantUserService.lambdaQuery()
                    .eq(TenantUser::getTenantId, tenant.getId())
                    .eq(TenantUser::getUserId, user.getId())
                    .exists();
            if (!exists) {
                TenantUser membership = new TenantUser();
                membership.setTenantId(tenant.getId());
                membership.setUserId(user.getId());
                membership.setTenantRole(resolveTenantRole(user));
                tenantUserService.save(membership);
            } else {
                tenantUserService.lambdaUpdate()
                        .eq(TenantUser::getTenantId, tenant.getId())
                        .eq(TenantUser::getUserId, user.getId())
                        .set(TenantUser::getTenantRole, resolveTenantRole(user))
                        .update();
            }
        }
    }

    private String resolveTenantRole(User user) {
        if (defaultTenantAdminUsername != null
                && defaultTenantAdminUsername.equalsIgnoreCase(user.getUsername())) {
            return TenantRole.ADMIN;
        }
        return TenantRole.MEMBER;
    }

    private static void applyInitialDefaults(Tenant tenant) {
        tenant.setDefaultParallelism(SystemDefaultsService.DEFAULT_PARALLELISM);
        tenant.setSavepointRetention(SystemDefaultsService.DEFAULT_SAVEPOINT_RETENTION);
        tenant.setJobVersionRetention(SystemDefaultsService.DEFAULT_JOB_VERSION_RETENTION);
        tenant.setJobExecutionRetention(SystemDefaultsService.DEFAULT_JOB_EXECUTION_RETENTION);
        tenant.setFailureAlertEnabled(SystemDefaultsService.DEFAULT_FAILURE_ALERT_ENABLED);
    }

    private static boolean isPlatformSuperAdmin(User user) {
        return PlatformRole.SUPER_ADMIN.equalsIgnoreCase(user.getRole());
    }
}
