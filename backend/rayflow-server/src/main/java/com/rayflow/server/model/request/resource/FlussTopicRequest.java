package com.rayflow.server.model.request.resource;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Fluss topic create/update request.
 */
@Data
public class FlussTopicRequest {

    @jakarta.validation.constraints.NotNull(message = "Fluss 集群 ID 不能为空")
    private Long clusterId;

    @NotBlank(message = "Topic 名称不能为空")
    @Size(max = 256, message = "Topic 名称不能超过 256 字符")
    private String topicName;

    @Size(max = 128, message = "Namespace 不能超过 128 字符")
    private String namespaceName = "default";

    @Min(value = 1, message = "Bucket 数不能小于 1")
    @Max(value = 4096, message = "Bucket 数不能超过 4096")
    private Integer bucketCount = 1;

    @Min(value = 1, message = "副本数不能小于 1")
    @Max(value = 9, message = "副本数不能超过 9")
    private Integer replicationFactor = 1;

    @Pattern(regexp = "CREATED|ACTIVE|INACTIVE", message = "Topic 状态不合法")
    private String status = "CREATED";

    private String description;
}
