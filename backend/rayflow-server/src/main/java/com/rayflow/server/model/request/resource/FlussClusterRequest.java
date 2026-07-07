package com.rayflow.server.model.request.resource;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Fluss cluster create/update request DTO.
 */
@Data
public class FlussClusterRequest {

    @NotBlank(message = "Fluss 集群名称不能为空")
    @Size(max = 128, message = "Fluss 集群名称不能超过 128 字符")
    private String clusterName;

    @NotBlank(message = "Bootstrap servers 不能为空")
    @Size(max = 512, message = "Bootstrap servers 不能超过 512 字符")
    private String bootstrapServers;

    @Size(max = 128, message = "默认数据库名称不能超过 128 字符")
    private String defaultDatabase = "default";

    @Pattern(regexp = "ACTIVE|INACTIVE", message = "Fluss 集群状态不合法")
    private String status = "ACTIVE";

    private String description;
}
