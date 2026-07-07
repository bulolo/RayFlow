package com.rayflow.server.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;

import java.util.Arrays;

/**
 * Fails fast on unsafe production security settings.
 */
@Component
@RequiredArgsConstructor
public class SecuritySettingsValidator {

    private final Environment environment;

    @Value("${rayflow.jwt.secret}")
    private String jwtSecret;

    @Value("${rayflow.preview.callback-token:}")
    private String previewCallbackToken;

    @PostConstruct
    public void validate() {
        if (jwtSecret == null || jwtSecret.length() < 32) {
            throw new IllegalStateException("JWT_SECRET must be at least 32 characters.");
        }
        if (isProd() && jwtSecret.toLowerCase().contains("change-this")) {
            throw new IllegalStateException("JWT_SECRET must be changed for production.");
        }
        if (isProd() && (previewCallbackToken == null
                || previewCallbackToken.isBlank()
                || "rayflow-preview-token".equals(previewCallbackToken))) {
            throw new IllegalStateException("RAYFLOW_PREVIEW_CALLBACK_TOKEN must be set to a strong value for production.");
        }
    }

    private boolean isProd() {
        return Arrays.asList(environment.getActiveProfiles()).contains("prod");
    }
}
