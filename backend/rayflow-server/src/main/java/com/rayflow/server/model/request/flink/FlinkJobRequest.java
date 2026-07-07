package com.rayflow.server.model.request.flink;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Flink job create/update request.
 */
@Data
public class FlinkJobRequest {

    @NotBlank(message = "作业名称不能为空")
    @Size(max = 256, message = "作业名称不能超过 256 字符")
    private String jobName;

    @Size(max = 128, message = "作业目录不能超过 128 字符")
    private String jobGroup;

    @Pattern(regexp = "JAR|SQL", message = "作业类型不合法")
    private String jobType = "JAR";

    @Pattern(regexp = "BATCH|STREAMING", message = "运行模式不合法")
    private String runtimeMode = "STREAMING";

    @Pattern(regexp = "REST|SQL_GATEWAY|K8S_APPLICATION", message = "提交方式不合法")
    private String submitType = "REST";

    @Pattern(regexp = "standalone|k8s-application", message = "执行模式不合法")
    private String executionMode = "standalone";

    private Long clusterId;

    private String content;

    private String mainClass;

    private String args;

    private String flinkConfig;

    @Min(value = 1, message = "并行度不能小于 1")
    @Max(value = 1024, message = "并行度不能超过 1024")
    private Integer parallelism = 1;

    private String description;

    @Size(max = 512, message = "作业标签不能超过 512 字符")
    private String jobTags;

    @Size(max = 1024, message = "文档链接不能超过 1024 字符")
    private String docUrl;

    private String savepointPath;

    @Size(max = 256, message = "作业镜像不能超过 256 字符")
    private String applicationImage;

    @Size(max = 512, message = "JAR URI 不能超过 512 字符")
    private String jarUri;

    private String dependencyRefs;

    private Long alertChannelId;

    private String alertRule = "FAILED";
}
