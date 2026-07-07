package com.rayflow.server.model.request.resource;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ModelProviderConfigRequest {

    @NotBlank(message = "提供商类型不能为空")
    @Pattern(regexp = "openai_compatible", message = "提供商类型不合法")
    private String provider;

    @NotBlank(message = "Base URL 不能为空")
    @Size(max = 512, message = "Base URL 不能超过 512 字符")
    private String baseUrl;

    @Size(max = 512, message = "API Key 不能超过 512 字符")
    private String apiKey;

    @NotBlank(message = "默认模型不能为空")
    @Size(max = 128, message = "默认模型不能超过 128 字符")
    private String defaultModel;

    private String models;

    private Boolean enabled = Boolean.FALSE;
}
