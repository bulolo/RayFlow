package com.rayflow.server.model.response.resource;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ModelProviderConfigResponse {

    private Long id;

    private String provider;

    private String baseUrl;

    private String apiKey;

    private String defaultModel;

    private String models;

    private Boolean enabled;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
