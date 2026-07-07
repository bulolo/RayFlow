package com.rayflow.server.config;

import com.rayflow.server.model.entity.User;
import com.rayflow.server.model.enums.PlatformRole;
import com.rayflow.server.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Arrays;

/**
 * Ensures built-in platform and default-tenant administrator accounts exist.
 */
@Slf4j
@Component
@Order(10)
@RequiredArgsConstructor
public class BootstrapAdminInitializer implements ApplicationRunner {

    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final Environment environment;

    @Value("${rayflow.super-admin.username:}")
    private String superAdminUsername;

    @Value("${rayflow.super-admin.password:}")
    private String superAdminPassword;

    @Value("${rayflow.default-tenant.admin.username:}")
    private String defaultTenantAdminUsername;

    @Value("${rayflow.default-tenant.admin.password:}")
    private String defaultTenantAdminPassword;

    @Override
    public void run(ApplicationArguments args) {
        ensureBootstrapUser(
                superAdminUsername,
                superAdminPassword,
                "Super Admin",
                PlatformRole.SUPER_ADMIN,
                "RAYFLOW_SUPER_ADMIN_USERNAME",
                "RAYFLOW_SUPER_ADMIN_PASSWORD"
        );
        ensureBootstrapUser(
                defaultTenantAdminUsername,
                defaultTenantAdminPassword,
                "Default Tenant Admin",
                PlatformRole.USER,
                "RAYFLOW_DEFAULT_TENANT_ADMIN_USERNAME",
                "RAYFLOW_DEFAULT_TENANT_ADMIN_PASSWORD"
        );
    }

    private void ensureBootstrapUser(
            String username,
            String password,
            String nickname,
            String role,
            String usernameEnv,
            String passwordEnv
    ) {
        if (isBlank(username)) {
            if (isProd()) {
                throw new IllegalStateException(usernameEnv + " is required.");
            }
            log.warn("{} is not configured; skip bootstrap user creation.", usernameEnv);
            return;
        }

        String normalizedUsername = username.trim();
        User existing = userService.findByUsername(normalizedUsername);
        if (existing != null) {
            existing.setEmail(normalizedUsername);
            existing.setNickname(nickname);
            existing.setRole(role);
            existing.setStatus(1);
            userService.updateById(existing);
            return;
        }

        if (isBlank(password)) {
            if (isProd()) {
                throw new IllegalStateException(passwordEnv + " is required.");
            }
            log.warn("{} is not configured; skip bootstrap user creation for {}.", passwordEnv, normalizedUsername);
            return;
        }
        if (isProd() && isWeakBootstrapPassword(password)) {
            throw new IllegalStateException(passwordEnv + " is too weak for production.");
        }

        User user = new User();
        user.setUsername(normalizedUsername);
        user.setEmail(normalizedUsername);
        user.setPassword(passwordEncoder.encode(password));
        user.setNickname(nickname);
        user.setRole(role);
        user.setStatus(1);
        userService.save(user);
        log.info("Bootstrap user created: {}", normalizedUsername);
    }

    private boolean isProd() {
        return Arrays.asList(environment.getActiveProfiles()).contains("prod");
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static boolean isWeakBootstrapPassword(String value) {
        String normalized = value.trim().toLowerCase();
        return normalized.length() < 12
                || normalized.equals("admin")
                || normalized.equals("admin123")
                || normalized.contains("change-me");
    }
}
