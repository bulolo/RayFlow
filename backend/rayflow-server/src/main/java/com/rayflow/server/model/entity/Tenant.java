package com.rayflow.server.model.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("rf_tenant")
public class Tenant {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantName;

    private String tenantSlug;

    private String status;

    private String description;

    private Integer defaultParallelism;

    private Integer savepointRetention;

    private Integer jobVersionRetention;

    private Integer jobExecutionRetention;

    private Boolean failureAlertEnabled;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
