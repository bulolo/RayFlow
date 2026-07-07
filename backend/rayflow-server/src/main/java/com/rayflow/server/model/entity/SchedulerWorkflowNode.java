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
@TableName("rf_scheduler_workflow_node")
public class SchedulerWorkflowNode {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long workflowId;
    private String nodeKey;
    private Long flinkJobId;
    private String jobName;
    private String jobType;
    private Integer maxRetries;
    private Integer retryInterval;
    private Integer timeoutMinutes;
    private String onTimeout;
    private Integer positionX;
    private Integer positionY;
    private Long tenantId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
