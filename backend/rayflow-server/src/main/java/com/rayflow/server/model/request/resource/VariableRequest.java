package com.rayflow.server.model.request.resource;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class VariableRequest {

    @NotBlank(message = "变量名不能为空")
    @Size(max = 128, message = "变量名不能超过 128 字符")
    private String variableName;

    private String variableValue;

    @Size(max = 512, message = "说明不能超过 512 字符")
    private String description;
}
