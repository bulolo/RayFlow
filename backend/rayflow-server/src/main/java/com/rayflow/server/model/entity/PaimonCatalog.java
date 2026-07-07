package com.rayflow.server.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Paimon Catalog 实体
 */
@Data
@TableName("rf_paimon_catalog")
public class PaimonCatalog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String catalogName;

    private String warehouse;

    private String metastoreType;

    private String options;

    private String status;

    private String description;

    private Long tenantId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
