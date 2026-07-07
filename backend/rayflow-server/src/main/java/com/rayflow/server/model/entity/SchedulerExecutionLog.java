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
@TableName("rf_scheduler_execution_log")
public class SchedulerExecutionLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long executionId;
    private Long workflowId;
    private Long nodeExecutionId;
    private String nodeKey;
    private String level;
    private String eventType;
    private String message;
    private Long tenantId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableLogic
    private Integer deleted;
}
