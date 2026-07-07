package com.rayflow.server.model.request.flink;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class FlinkSqlValidateRequest {

    @NotNull(message = "运行时不能为空")
    private Long clusterId;

    @NotBlank(message = "SQL 内容不能为空")
    private String sql;
}
