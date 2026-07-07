package com.rayflow.server.model.request.resource;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * StarRocks connection create/update request.
 */
@Data
public class StarRocksConnectionRequest {

    @NotBlank(message = "连接名称不能为空")
    @Size(max = 128, message = "连接名称不能超过 128 字符")
    private String connectionName;

    @NotBlank(message = "FE 地址不能为空")
    @Size(max = 256, message = "FE 地址不能超过 256 字符")
    private String feAddress;

    @Min(value = 1, message = "查询端口不合法")
    @Max(value = 65535, message = "查询端口不合法")
    private Integer queryPort = 9030;

    @NotBlank(message = "用户名不能为空")
    @Size(max = 128, message = "用户名不能超过 128 字符")
    private String username;

    @Size(max = 256, message = "密码不能超过 256 字符")
    private String password;

    @Size(max = 128, message = "默认库不能超过 128 字符")
    private String defaultDatabase = "scm";

    @Pattern(regexp = "ACTIVE|INACTIVE", message = "连接状态不合法")
    private String status = "ACTIVE";

    private String description;
}
