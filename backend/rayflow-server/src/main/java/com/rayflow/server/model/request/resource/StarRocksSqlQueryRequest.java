package com.rayflow.server.model.request.resource;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class StarRocksSqlQueryRequest {

    @NotBlank(message = "SQL 不能为空")
    @Size(max = 20000, message = "SQL 不能超过 20000 字符")
    private String sql;

    @Min(value = 1, message = "返回行数不能小于 1")
    @Max(value = 5000, message = "返回行数不能超过 5000")
    private Integer limit = 1000;
}
