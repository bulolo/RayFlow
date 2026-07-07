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
@TableName("rf_scheduler_execution")
public class SchedulerExecution {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long workflowId;
    private Long versionId;
    private String triggerType;
    private String status;
    private String message;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private String ownerInstanceId;
    private LocalDateTime heartbeatAt;
    private Long tenantId;
    private Long createdBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
