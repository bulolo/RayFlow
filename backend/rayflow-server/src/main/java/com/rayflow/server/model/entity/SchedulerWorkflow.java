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
@TableName("rf_scheduler_workflow")
public class SchedulerWorkflow {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String workflowName;
    private String description;
    private String cron;
    private String period;
    private String timezone;
    private String status;
    private String executionMode;
    private String failureStrategy;
    private String concurrentPolicy;
    private Long alertChannelId;
    private LocalDateTime lastRunTime;
    private LocalDateTime nextRunTime;
    private Long tenantId;
    private Long createdBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
