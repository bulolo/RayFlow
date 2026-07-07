package com.rayflow.server.model.request.resource;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Paimon catalog create/update request.
 */
@Data
public class PaimonCatalogRequest {

    @NotBlank(message = "Catalog 名称不能为空")
    @Size(max = 128, message = "Catalog 名称不能超过 128 字符")
    private String catalogName;

    @NotBlank(message = "Warehouse 不能为空")
    @Size(max = 512, message = "Warehouse 不能超过 512 字符")
    private String warehouse;

    @Pattern(regexp = "filesystem|hive|jdbc|rest", message = "Metastore 类型不合法")
    private String metastoreType = "filesystem";

    private String options;

    @Pattern(regexp = "ACTIVE|INACTIVE", message = "Catalog 状态不合法")
    private String status = "ACTIVE";

    private String description;
}
