package com.rayflow.server.model.request.resource;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Map;

@Data
public class NotificationChannelRequest {

    @NotBlank(message = "渠道名称不能为空")
    @Size(max = 128, message = "渠道名称不能超过 128 字符")
    private String name;

    @NotBlank(message = "渠道类型不能为空")
    @Pattern(regexp = "feishu|webhook|dingtalk|wecom|inapp", message = "渠道类型不合法")
    private String type;

    private Map<String, String> config;

    private Boolean enabled = Boolean.TRUE;
}
