package com.rayflow.server.model.response.resource;

import com.rayflow.server.model.entity.PaimonCatalog;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Paimon catalog detail view for edit scenarios.
 */
@Data
@Builder
public class PaimonCatalogDetailResponse {

    private Long id;
    private String catalogName;
    private String warehouse;
    private String metastoreType;
    private String options;
    private String status;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static PaimonCatalogDetailResponse from(PaimonCatalog catalog) {
        return PaimonCatalogDetailResponse.builder()
                .id(catalog.getId())
                .catalogName(catalog.getCatalogName())
                .warehouse(catalog.getWarehouse())
                .metastoreType(catalog.getMetastoreType())
                .options(catalog.getOptions())
                .status(catalog.getStatus())
                .description(catalog.getDescription())
                .createdAt(catalog.getCreatedAt())
                .updatedAt(catalog.getUpdatedAt())
                .build();
    }
}
