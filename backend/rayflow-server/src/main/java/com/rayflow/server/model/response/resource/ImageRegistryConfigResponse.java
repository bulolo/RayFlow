package com.rayflow.server.model.response.resource;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ImageRegistryConfigResponse {

    private Long id;

    private String registryUrl;

    private String namespaceName;

    private String username;

    private String password;

    private Boolean enabled;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
