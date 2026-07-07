package com.rayflow.server.model.response.resource;

import com.rayflow.server.model.entity.FlinkJarResource;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class FlinkJarResourceResponse {

    private Long id;
    private String resourceName;
    private String resourceVersion;
    private String compatibleFlinkVersion;
    private String storageUri;
    private String checksum;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static FlinkJarResourceResponse from(FlinkJarResource resource) {
        return FlinkJarResourceResponse.builder()
                .id(resource.getId())
                .resourceName(resource.getResourceName())
                .resourceVersion(resource.getResourceVersion())
                .compatibleFlinkVersion(resource.getCompatibleFlinkVersion())
                .storageUri(resource.getStorageUri())
                .checksum(resource.getChecksum())
                .status(resource.getStatus())
                .createdAt(resource.getCreatedAt())
                .updatedAt(resource.getUpdatedAt())
                .build();
    }
}
