package com.rayflow.server.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.mapper.ImageRegistryConfigMapper;
import com.rayflow.server.model.entity.ImageRegistryConfig;
import com.rayflow.server.model.request.resource.ImageRegistryConfigRequest;
import com.rayflow.server.model.response.resource.ImageRegistryConfigResponse;
import com.rayflow.server.security.SecretCipher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;

@Slf4j
@Service
@RequiredArgsConstructor
public class ImageRegistryConfigService extends ServiceImpl<ImageRegistryConfigMapper, ImageRegistryConfig> {

    private final TenantAccessService tenantAccessService;
    private final SecretCipher secretCipher;

    public ImageRegistryConfigResponse getCurrentTenantConfig() {
        ImageRegistryConfig config = findByTenantId(tenantAccessService.requireCurrentTenantId());
        return config == null ? defaultResponse() : toResponse(config);
    }

    public RegistryCredential requireEnabledCredential(Long tenantId) {
        ImageRegistryConfig config = findByTenantId(tenantId);
        if (config == null || config.getEnabled() == null || config.getEnabled() != 1) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "镜像仓库未启用，请先在配置中心配置镜像仓库");
        }
        String registryUrl = config.getRegistryUrl();
        URI uri = URI.create(normalizeRegistryUrl(registryUrl));
        String authority = uri.getPort() > 0 ? uri.getHost() + ":" + uri.getPort() : uri.getHost();
        return new RegistryCredential(
                normalizeRegistryUrl(registryUrl),
                authority,
                trimToEmpty(config.getNamespaceName()),
                trimToEmpty(config.getUsername()),
                secretCipher.decrypt(config.getPassword())
        );
    }

    public ImageRegistryConfigResponse saveCurrentTenantConfig(ImageRegistryConfigRequest request) {
        Long tenantId = tenantAccessService.requireCurrentTenantId();
        validateRequest(request);
        ImageRegistryConfig config = findByTenantId(tenantId);
        String password = resolvePassword(config, request.getPassword());
        ensureHarborProject(request.getRegistryUrl(), request.getNamespaceName(), request.getUsername(), password);
        if (config == null) {
            config = new ImageRegistryConfig();
            config.setTenantId(tenantId);
        }
        applyRequest(config, request);
        saveOrUpdate(config);
        return toResponse(config);
    }

    public boolean testCurrentTenantConfig(ImageRegistryConfigRequest request) {
        Long tenantId = tenantAccessService.requireCurrentTenantId();
        validateRequest(request);
        ImageRegistryConfig existing = findByTenantId(tenantId);
        String password = resolvePassword(existing, request.getPassword());
        try {
            URI uri = URI.create(normalizeRegistryUrl(request.getRegistryUrl()) + "/v2/");
            HttpRequest.Builder builder = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(5))
                    .GET();
            addBasicAuth(builder, request.getUsername(), password);
            HttpResponse<String> response = HttpClient.newHttpClient().send(builder.build(), HttpResponse.BodyHandlers.ofString());
            return response.statusCode() >= 200 && response.statusCode() < 400;
        } catch (Exception e) {
            log.warn("Image registry test failed: registryUrl={}", request.getRegistryUrl(), e);
            return false;
        }
    }

    private ImageRegistryConfig findByTenantId(Long tenantId) {
        return lambdaQuery()
                .eq(ImageRegistryConfig::getTenantId, tenantId)
                .last("LIMIT 1")
                .one();
    }

    private void validateRequest(ImageRegistryConfigRequest request) {
        try {
            URI uri = URI.create(normalizeRegistryUrl(request.getRegistryUrl()));
            if (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme())) {
                throw new IllegalArgumentException("unsupported scheme");
            }
            if (!StringUtils.hasText(uri.getHost())) {
                throw new IllegalArgumentException("missing host");
            }
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "镜像仓库地址不合法");
        }
    }

    private void ensureHarborProject(String registryUrl, String namespaceName, String username, String password) {
        if (!StringUtils.hasText(namespaceName)) {
            return;
        }
        String normalizedRegistryUrl = normalizeRegistryUrl(registryUrl);
        String projectName = namespaceName.trim();
        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(5))
                    .build();
            String encodedName = URLEncoder.encode(projectName, StandardCharsets.UTF_8);
            HttpRequest.Builder queryBuilder = HttpRequest.newBuilder(URI.create(normalizedRegistryUrl + "/api/v2.0/projects?name=" + encodedName))
                    .timeout(Duration.ofSeconds(8))
                    .GET();
            addBasicAuth(queryBuilder, username, password);
            HttpResponse<String> queryResponse = client.send(queryBuilder.build(), HttpResponse.BodyHandlers.ofString());
            if (queryResponse.statusCode() == 404) {
                return;
            }
            if (queryResponse.statusCode() == 401 || queryResponse.statusCode() == 403) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "镜像仓库账号无权限查询 Harbor 项目，请检查用户名或 Token");
            }
            if (queryResponse.statusCode() < 200 || queryResponse.statusCode() >= 300) {
                log.warn("Harbor project query skipped: registryUrl={}, status={}", normalizedRegistryUrl, queryResponse.statusCode());
                return;
            }
            if (queryResponse.body() != null && queryResponse.body().contains("\"name\":\"" + projectName + "\"")) {
                return;
            }

            String payload = "{\"project_name\":\"" + escapeJson(projectName) + "\",\"metadata\":{\"public\":\"false\"},\"storage_limit\":-1}";
            HttpRequest.Builder createBuilder = HttpRequest.newBuilder(URI.create(normalizedRegistryUrl + "/api/v2.0/projects"))
                    .timeout(Duration.ofSeconds(8))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8));
            addBasicAuth(createBuilder, username, password);
            HttpResponse<String> createResponse = client.send(createBuilder.build(), HttpResponse.BodyHandlers.ofString());
            if (createResponse.statusCode() == 201 || createResponse.statusCode() == 409) {
                return;
            }
            if (createResponse.statusCode() == 401 || createResponse.statusCode() == 403) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "镜像仓库账号无权限创建 Harbor 项目: " + projectName);
            }
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "创建 Harbor 项目失败: HTTP " + createResponse.statusCode() + " " + createResponse.body());
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Harbor project ensure skipped: registryUrl={}, project={}, error={}", normalizedRegistryUrl, projectName, e.getMessage());
        }
    }

    private void addBasicAuth(HttpRequest.Builder builder, String username, String password) {
        if (StringUtils.hasText(username) && StringUtils.hasText(password)) {
            String token = username.trim() + ":" + password;
            builder.header("Authorization", "Basic " + Base64.getEncoder().encodeToString(token.getBytes(StandardCharsets.UTF_8)));
        }
    }

    private String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private void applyRequest(ImageRegistryConfig config, ImageRegistryConfigRequest request) {
        config.setRegistryUrl(normalizeRegistryUrl(request.getRegistryUrl()));
        config.setNamespaceName(trimToEmpty(request.getNamespaceName()));
        config.setUsername(trimToEmpty(request.getUsername()));
        if (request.getPassword() != null && !isMaskedSecret(request.getPassword())) {
            config.setPassword(secretCipher.encrypt(request.getPassword().trim()));
        }
        config.setEnabled(Boolean.TRUE.equals(request.getEnabled()) ? 1 : 0);
    }

    private ImageRegistryConfigResponse toResponse(ImageRegistryConfig config) {
        ImageRegistryConfigResponse response = new ImageRegistryConfigResponse();
        response.setId(config.getId());
        response.setRegistryUrl(config.getRegistryUrl());
        response.setNamespaceName(config.getNamespaceName());
        response.setUsername(config.getUsername());
        response.setPassword(maskSecret(secretCipher.decrypt(config.getPassword())));
        response.setEnabled(config.getEnabled() != null && config.getEnabled() == 1);
        response.setCreatedAt(config.getCreatedAt());
        response.setUpdatedAt(config.getUpdatedAt());
        return response;
    }

    private ImageRegistryConfigResponse defaultResponse() {
        ImageRegistryConfigResponse response = new ImageRegistryConfigResponse();
        response.setRegistryUrl("https://registry-1.docker.io");
        response.setNamespaceName("rayflow");
        response.setUsername("");
        response.setPassword("");
        response.setEnabled(false);
        return response;
    }

    private String normalizeRegistryUrl(String registryUrl) {
        String normalized = registryUrl.trim();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
            normalized = "https://" + normalized;
        }
        return normalized;
    }

    private String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private String maskSecret(String secret) {
        if (!StringUtils.hasText(secret)) {
            return "";
        }
        if (secret.length() <= 8) {
            return "******";
        }
        return secret.substring(0, 4) + "******" + secret.substring(secret.length() - 4);
    }

    private boolean isMaskedSecret(String secret) {
        return StringUtils.hasText(secret) && secret.contains("******");
    }

    private String resolvePassword(ImageRegistryConfig existing, String requestPassword) {
        if (isMaskedSecret(requestPassword)) {
            return existing == null ? "" : secretCipher.decrypt(existing.getPassword());
        }
        return requestPassword == null ? "" : requestPassword.trim();
    }

    public record RegistryCredential(
            String registryUrl,
            String registryAuthority,
            String namespaceName,
            String username,
            String password
    ) {}
}
