package com.rayflow.server.model.request.flink;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * Flink cluster create/update request.
 */
@Data
@Schema(name = "FlinkRuntimeRequest")
public class FlinkClusterRequest {

    @NotBlank(message = "运行时名称不能为空")
    @Size(max = 128, message = "运行时名称不能超过 128 字符")
    private String clusterName;

    @NotBlank(message = "运行时类型不能为空")
    @Pattern(regexp = "standalone|kubernetes", message = "运行时类型不合法")
    private String clusterType;

    @Pattern(regexp = "session|application", message = "部署模式不合法")
    private String deploymentMode = "session";

    @Size(max = 256, message = "JobManager 地址不能超过 256 字符")
    @Pattern(regexp = "https?://[^\\s]+", message = "JobManager 地址必须是 http(s) URL")
    private String address;

    @Size(max = 256, message = "SQL Gateway 地址不能超过 256 字符")
    @Pattern(regexp = "https?://[^\\s]+", message = "SQL Gateway 地址必须是 http(s) URL")
    private String gatewayAddress;

    @Pattern(regexp = "RUNNING|STOPPED|UNREACHABLE", message = "运行时状态不合法")
    private String status;

    @Size(max = 32, message = "Flink 版本不能超过 32 字符")
    private String flinkVersion;

    @Size(max = 128, message = "Kubernetes namespace 不能超过 128 字符")
    private String namespaceName;

    @Size(max = 128, message = "Kubernetes serviceAccount 不能超过 128 字符")
    private String serviceAccount;

    @Size(max = 256, message = "镜像地址不能超过 256 字符")
    private String image;

    @Pattern(regexp = "IfNotPresent|Always|Never", message = "镜像拉取策略不合法")
    private String imagePullPolicy;

    @Pattern(regexp = "CLUSTER_IP|NODE_PORT|LOAD_BALANCER", message = "Kubernetes 服务对外类型不合法")
    private String serviceExposureType;

    private String kubeConfigRef;

    private String podTemplate;

    @Min(value = 1, message = "默认并行度不能小于 1")
    @Max(value = 1024, message = "默认并行度不能超过 1024")
    private Integer defaultParallelism;

    @Size(max = 512, message = "Checkpoint 路径不能超过 512 字符")
    private String checkpointDir;

    @Size(max = 512, message = "Savepoint 路径不能超过 512 字符")
    private String savepointDir;

    private String description;
}
