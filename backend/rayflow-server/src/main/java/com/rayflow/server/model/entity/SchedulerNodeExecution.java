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
@TableName("rf_scheduler_node_execution")
public class SchedulerNodeExecution {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long executionId;
    private Long workflowId;
    private String nodeKey;
    private Long flinkJobId;
    private String flinkRuntimeJobId;
    private String status;
    private Integer retryIndex;
    private String message;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private Long tenantId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
