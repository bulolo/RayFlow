package com.rayflow.server.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Fluss 集群实体
 */
@Data
@TableName("rf_fluss_cluster")
public class FlussCluster {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String clusterName;

    private String bootstrapServers;

    private String defaultDatabase;

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
