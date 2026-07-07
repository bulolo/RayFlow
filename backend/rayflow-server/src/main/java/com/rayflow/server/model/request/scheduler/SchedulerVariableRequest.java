package com.rayflow.server.model.request.scheduler;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SchedulerVariableRequest {

    @NotBlank(message = "变量名不能为空")
    @Pattern(regexp = "[A-Za-z_][A-Za-z0-9_\\-]*", message = "变量名只能包含字母、数字、下划线或中划线，且不能以数字开头")
    @Size(max = 128, message = "变量名不能超过 128 字符")
    private String variableKey;

    private String variableValue;
}
