package com.rayflow.server.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Flink 作业实体
 */
@Data
@TableName("rf_flink_job")
public class FlinkJob {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 作业名称 */
    private String jobName;

    /** 作业目录/分组 */
    private String jobGroup;

    /** 作业类型: JAR / SQL */
    @TableField("job_type")
    private String jobType;

    /** SQL 运行模式: BATCH / STREAMING */
    private String runtimeMode;

    /** 提交方式: REST / SQL_GATEWAY / K8S_APPLICATION */
    private String submitType;

    /** 执行模式: standalone / k8s-application */
    private String executionMode;

    /** Flink 运行时 ID */
    private Long clusterId;

    /** 告警通知渠道 ID */
    private Long alertChannelId;

    /** 告警触发策略（以逗号分隔，如 FAILED,CANCELED,FINISHED） */
    private String alertRule = "FAILED";

    /** Flink Job ID (运行后分配) */
    private String flinkJobId;

    /** 作业状态: CREATED / SUBMITTING / RUNNING / FINISHED / FAILED / CANCELED / SUSPENDED */
    private String status;

    /** 发布状态: UNPUBLISHED / OUTDATED / PUBLISHED */
    private String publishStatus;

    /** JAR 路径或 SQL 内容 */
    private String content;

    /** JAR 入口类 */
    private String mainClass;

    /** 启动参数 (JSON) */
    private String args;

    /** Flink 配置 (JSON) */
    private String flinkConfig;

    /** 并行度 */
    private Integer parallelism;

    /** 最后 Savepoint 路径 */
    private String savepointPath;

    /** K8s Application 作业镜像 */
    private String applicationImage;

    /** K8s Application JAR URI */
    private String jarUri;

    /** 依赖资源引用 */
    private String dependencyRefs;

    /** 描述 */
    private String description;

    /** 文档链接 */
    private String docUrl;

    /** 租户 ID */
    private Long tenantId;

    /** 当前运行执行记录 ID */
    private Long currentExecutionId;

    /** 创建人 */
    private Long createdBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
