package com.rayflow.server.model.request.flink;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Flink SQL 预览调试请求 DTO
 */
@Data
public class FlinkSqlPreviewRequest {

    @NotNull(message = "运行时不能为空")
    private Long clusterId;

    @NotBlank(message = "SQL 内容不能为空")
    private String sql;

    /** 用作 Flink pipeline.name，控制 Flink UI 中的作业名称 */
    private String jobName;

    /** 最大预览条数，默认 50 */
    private Integer limit = 50;
}
