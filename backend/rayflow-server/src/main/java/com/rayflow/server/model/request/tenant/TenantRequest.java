package com.rayflow.server.model.request.tenant;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class TenantRequest {

    @NotBlank(message = "组织名称不能为空")
    @Size(max = 128, message = "组织名称不能超过 128 字符")
    private String tenantName;

    @NotBlank(message = "组织标识不能为空")
    @Pattern(regexp = "[a-z0-9][a-z0-9-]{1,62}", message = "组织标识仅支持小写字母、数字和中划线")
    private String tenantSlug;

    @Pattern(regexp = "ACTIVE|INACTIVE", message = "状态不合法")
    private String status = "ACTIVE";

    @Size(max = 512, message = "描述不能超过 512 字符")
    private String description;

    @Size(max = 64, message = "初始租户管理员用户名不能超过 64 字符")
    private String adminUsername;

    @Size(min = 8, max = 128, message = "初始租户管理员密码长度必须在 8 到 128 字符之间")
    private String adminPassword;

    @Size(max = 64, message = "初始租户管理员昵称不能超过 64 字符")
    private String adminNickname;

    @Email(message = "初始租户管理员邮箱格式不合法")
    @Size(max = 128, message = "初始租户管理员邮箱不能超过 128 字符")
    private String adminEmail;
}
