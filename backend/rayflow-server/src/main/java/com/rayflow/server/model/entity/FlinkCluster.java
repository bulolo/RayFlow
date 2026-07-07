package com.rayflow.server.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Flink 运行时实体
 */
@Data
@TableName("rf_flink_cluster")
public class FlinkCluster {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 运行时名称 */
    private String clusterName;

    /** 运行时类型: standalone / kubernetes */
    private String clusterType;

    /** 部署模式: session / application */
    private String deploymentMode;

    /** JobManager 地址 */
    private String address;

    /** 运行时状态: RUNNING / STOPPED / UNREACHABLE */
    private String status;

    /** Flink 版本 */
    private String flinkVersion;

    /** 描述 */
    private String description;

    /** SQL Gateway 地址 */
    private String gatewayAddress;

    /** SQL Gateway 状态: RUNNING / UNREACHABLE / NOT_CONFIGURED */
    private String gatewayStatus;

    /** K8s namespace */
    private String namespaceName;

    /** K8s serviceAccount */
    private String serviceAccount;

    /** Flink runtime 镜像 */
    private String image;

    /** 镜像拉取策略 */
    private String imagePullPolicy;

    /** K8s 服务对外类型: CLUSTER_IP / NODE_PORT / LOAD_BALANCER / INGRESS */
    private String serviceExposureType;

    /** K8s 凭证引用 */
    private String kubeConfigRef;

    /** Kubernetes Pod Template YAML */
    private String podTemplate;

    /** 默认并行度 */
    private Integer defaultParallelism;

    /** 默认 checkpoint 路径 */
    private String checkpointDir;

    /** 默认 savepoint 路径 */
    private String savepointDir;

    /** 集群作用域: PLATFORM / TENANT */
    private String clusterScope;

    /** 租户 ID */
    private Long tenantId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
