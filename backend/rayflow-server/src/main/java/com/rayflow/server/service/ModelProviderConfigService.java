package com.rayflow.server.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.mapper.ModelProviderConfigMapper;
import com.rayflow.server.model.entity.ModelProviderConfig;
import com.rayflow.server.model.request.resource.ModelProviderConfigRequest;
import com.rayflow.server.model.response.resource.ModelProviderConfigResponse;
import com.rayflow.server.security.SecretCipher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Slf4j
@Service
@RequiredArgsConstructor
public class ModelProviderConfigService extends ServiceImpl<ModelProviderConfigMapper, ModelProviderConfig> {

    private static final String PROVIDER_OPENAI_COMPATIBLE = "openai_compatible";

    private final TenantAccessService tenantAccessService;
    private final SecretCipher secretCipher;

    public ModelProviderConfigResponse getCurrentTenantConfig() {
        Long tenantId = tenantAccessService.requireCurrentTenantId();
        ModelProviderConfig config = findByTenantId(tenantId);
        if (config == null) {
            return defaultResponse();
        }
        return toResponse(config);
    }

    public ModelProviderConfigResponse saveCurrentTenantConfig(ModelProviderConfigRequest request) {
        Long tenantId = tenantAccessService.requireCurrentTenantId();
        validateRequest(request);
        ModelProviderConfig config = findByTenantId(tenantId);
        if (config == null) {
            config = new ModelProviderConfig();
            config.setTenantId(tenantId);
        }
        applyRequest(config, request);
        saveOrUpdate(config);
        return toResponse(config);
    }

    public boolean testCurrentTenantConfig(ModelProviderConfigRequest request) {
        Long tenantId = tenantAccessService.requireCurrentTenantId();
        validateRequest(request);
        String baseUrl = normalizeBaseUrl(request.getBaseUrl());
        ModelProviderConfig existing = findByTenantId(tenantId);
        String apiKey = resolveApiKey(existing, request.getApiKey());
        try {
            URI uri = URI.create(baseUrl + "/models");
            HttpRequest.Builder builder = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(5))
                    .GET();
            if (StringUtils.hasText(apiKey)) {
                builder.header("Authorization", "Bearer " + apiKey);
            }
            HttpResponse<String> response = HttpClient.newHttpClient().send(builder.build(), HttpResponse.BodyHandlers.ofString());
            return response.statusCode() >= 200 && response.statusCode() < 300;
        } catch (Exception e) {
            log.warn("Model provider test failed: provider={}, baseUrl={}", request.getProvider(), request.getBaseUrl(), e);
            return false;
        }
    }

    private ModelProviderConfig findByTenantId(Long tenantId) {
        return lambdaQuery()
                .eq(ModelProviderConfig::getTenantId, tenantId)
                .last("LIMIT 1")
                .one();
    }

    private void validateRequest(ModelProviderConfigRequest request) {
        if (!StringUtils.hasText(request.getProvider())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "提供商类型不能为空");
        }
        if (!StringUtils.hasText(request.getBaseUrl())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Base URL 不能为空");
        }
        if (!StringUtils.hasText(request.getDefaultModel())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "默认模型不能为空");
        }
        try {
            URI.create(normalizeBaseUrl(request.getBaseUrl()));
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Base URL 不合法");
        }
    }

    private void applyRequest(ModelProviderConfig config, ModelProviderConfigRequest request) {
        config.setProvider(PROVIDER_OPENAI_COMPATIBLE);
        config.setBaseUrl(normalizeBaseUrl(request.getBaseUrl()));
        if (request.getApiKey() != null && !isMaskedApiKey(request.getApiKey())) {
            config.setApiKey(secretCipher.encrypt(request.getApiKey().trim()));
        }
        config.setDefaultModel(request.getDefaultModel().trim());
        config.setModels(request.getModels() == null ? "" : request.getModels().trim());
        config.setEnabled(Boolean.TRUE.equals(request.getEnabled()) ? 1 : 0);
    }

    private ModelProviderConfigResponse toResponse(ModelProviderConfig config) {
        ModelProviderConfigResponse response = new ModelProviderConfigResponse();
        response.setId(config.getId());
        response.setProvider(config.getProvider());
        response.setBaseUrl(config.getBaseUrl());
        response.setApiKey(maskApiKey(secretCipher.decrypt(config.getApiKey())));
        response.setDefaultModel(config.getDefaultModel());
        response.setModels(config.getModels());
        response.setEnabled(config.getEnabled() != null && config.getEnabled() == 1);
        response.setCreatedAt(config.getCreatedAt());
        response.setUpdatedAt(config.getUpdatedAt());
        return response;
    }

    private ModelProviderConfigResponse defaultResponse() {
        ModelProviderConfigResponse response = new ModelProviderConfigResponse();
        response.setProvider(PROVIDER_OPENAI_COMPATIBLE);
        response.setBaseUrl("https://api.openai.com/v1");
        response.setApiKey("");
        response.setDefaultModel("gpt-4.1-mini");
        response.setModels("gpt-4.1,gpt-4.1-mini,text-embedding-3-large");
        response.setEnabled(false);
        return response;
    }

    private String normalizeBaseUrl(String baseUrl) {
        String normalized = baseUrl.trim();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private String maskApiKey(String apiKey) {
        if (!StringUtils.hasText(apiKey)) {
            return "";
        }
        if (apiKey.length() <= 8) {
            return "******";
        }
        return apiKey.substring(0, 4) + "******" + apiKey.substring(apiKey.length() - 4);
    }

    private boolean isMaskedApiKey(String apiKey) {
        return StringUtils.hasText(apiKey) && apiKey.contains("******");
    }

    private String resolveApiKey(ModelProviderConfig existing, String requestApiKey) {
        if (isMaskedApiKey(requestApiKey)) {
            return existing == null ? "" : secretCipher.decrypt(existing.getApiKey());
        }
        return requestApiKey == null ? "" : requestApiKey.trim();
    }
}
