package com.rayflow.server.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Fluss Topic 实体
 */
@Data
@TableName("rf_fluss_topic")
public class FlussTopic {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long clusterId;

    private String topicName;

    private String namespaceName;

    private Integer bucketCount;

    private Integer replicationFactor;

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
