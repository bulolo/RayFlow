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
@TableName("rf_flink_job_version")
public class FlinkJobVersion {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long jobId;
    private Integer versionNo;
    private String versionName;
    private String snapshotJson;
    private String remark;
    private String imageUri;
    private String imageDigest;
    private String imagePublishStatus;
    private String imagePublishLog;
    /** 异步构建时 Worker 任务 ID，用于后台轮询更新构建状态 */
    private String imageBuildTaskId;
    private Long tenantId;
    private Long createdBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
