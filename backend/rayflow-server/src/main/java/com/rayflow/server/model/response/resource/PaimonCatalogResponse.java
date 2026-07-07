package com.rayflow.server.model.response.resource;

import com.rayflow.server.model.entity.PaimonCatalog;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class PaimonCatalogResponse {

    private Long id;
    private String catalogName;
    private String warehouse;
    private String metastoreType;
    private String options;
    private String status;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static PaimonCatalogResponse from(PaimonCatalog catalog) {
        return PaimonCatalogResponse.builder()
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
