package com.rayflow.server.model.request.resource;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class FlinkJarResourceRequest {

    @NotBlank(message = "资源名称不能为空")
    @Size(max = 128, message = "资源名称不能超过 128 字符")
    private String resourceName;

    @Size(max = 64, message = "版本不能超过 64 字符")
    private String resourceVersion = "1.0.0";

    @Size(max = 64, message = "兼容 Flink 版本不能超过 64 字符")
    private String compatibleFlinkVersion = "2.x";

    @NotBlank(message = "存储地址不能为空")
    @Size(max = 512, message = "存储地址不能超过 512 字符")
    private String storageUri;

    @Size(max = 128, message = "校验值不能超过 128 字符")
    private String checksum;

    @Pattern(regexp = "ACTIVE|INACTIVE", message = "资源状态不合法")
    private String status = "ACTIVE";
}
