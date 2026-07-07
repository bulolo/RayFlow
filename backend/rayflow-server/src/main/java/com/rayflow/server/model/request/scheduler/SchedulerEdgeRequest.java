package com.rayflow.server.model.request.scheduler;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import static com.rayflow.server.model.enums.SchedulerConstants.EDGE_STRATEGY_PATTERN;
import static com.rayflow.server.model.enums.SchedulerConstants.EDGE_STRATEGY_WAIT_SUCCESS;

@Data
public class SchedulerEdgeRequest {

    @NotBlank(message = "上游节点不能为空")
    @Size(max = 64, message = "上游节点标识不能超过 64 字符")
    private String fromNodeKey;

    @NotBlank(message = "下游节点不能为空")
    @Size(max = 64, message = "下游节点标识不能超过 64 字符")
    private String toNodeKey;

    @Pattern(regexp = EDGE_STRATEGY_PATTERN, message = "依赖策略不合法")
    private String strategy = EDGE_STRATEGY_WAIT_SUCCESS;
}
