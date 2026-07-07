package com.rayflow.server.model.request.tenant;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * User create request.
 */
@Data
public class UserCreateRequest {

    @NotBlank(message = "用户名不能为空")
    @Size(max = 64, message = "用户名不能超过 64 字符")
    private String username;

    @NotBlank(message = "密码不能为空")
    @Size(min = 8, max = 128, message = "密码长度必须在 8 到 128 字符之间")
    private String password;

    @Size(max = 64, message = "昵称不能超过 64 字符")
    private String nickname;

    @Email(message = "邮箱格式不合法")
    @Size(max = 128, message = "邮箱不能超过 128 字符")
    private String email;

    /** 租户角色: ADMIN / MEMBER */
    @Pattern(regexp = "ADMIN|MEMBER", message = "角色不合法")
    private String role = "MEMBER";

    private Integer status = 1;
}
