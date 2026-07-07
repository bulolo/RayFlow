package com.rayflow.server.model.request.resource;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class StarRocksDdlRequest {

    @NotBlank(message = "SQL 不能为空")
    @Size(max = 20000, message = "SQL 不能超过 20000 字符")
    private String sql;
}
