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
@TableName("rf_flink_job_execution")
public class FlinkJobExecution {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long jobId;
    private Long versionId;
    private String versionName;
    private String flinkJobId;
    private String status;
    private String submitPayload;
    private String errorLog;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Long duration;
    private Long tenantId;
    private Long createdBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
