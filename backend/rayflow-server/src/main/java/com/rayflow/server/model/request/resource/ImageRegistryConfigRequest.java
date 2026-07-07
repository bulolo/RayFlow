package com.rayflow.server.model.request.resource;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ImageRegistryConfigRequest {

    @NotBlank(message = "镜像仓库地址不能为空")
    @Size(max = 512, message = "镜像仓库地址不能超过 512 字符")
    private String registryUrl;

    @Size(max = 128, message = "命名空间不能超过 128 字符")
    private String namespaceName;

    @Size(max = 256, message = "用户名不能超过 256 字符")
    private String username;

    @Size(max = 512, message = "密码或 Token 不能超过 512 字符")
    private String password;

    private Boolean enabled = Boolean.FALSE;
}
