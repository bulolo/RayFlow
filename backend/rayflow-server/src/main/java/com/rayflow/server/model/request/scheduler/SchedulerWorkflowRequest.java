package com.rayflow.server.model.request.scheduler;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import static com.rayflow.server.model.enums.SchedulerConstants.CONCURRENT_POLICY_PATTERN;
import static com.rayflow.server.model.enums.SchedulerConstants.CONCURRENT_POLICY_SERIAL_RUNS;
import static com.rayflow.server.model.enums.SchedulerConstants.EXECUTION_MODE_PATTERN;
import static com.rayflow.server.model.enums.SchedulerConstants.EXECUTION_MODE_TOPOLOGY;
import static com.rayflow.server.model.enums.SchedulerConstants.FAILURE_STRATEGY_BLOCK_ALL;
import static com.rayflow.server.model.enums.SchedulerConstants.FAILURE_STRATEGY_PATTERN;
import static com.rayflow.server.model.enums.SchedulerConstants.WORKFLOW_STATUS_PATTERN;
import static com.rayflow.server.model.enums.SchedulerConstants.WORKFLOW_STATUS_PAUSED;

@Data
public class SchedulerWorkflowRequest {

    @NotBlank(message = "工作流名称不能为空")
    @Size(max = 256, message = "工作流名称不能超过 256 字符")
    private String workflowName;

    private String description;

    @Size(max = 128, message = "Cron 表达式不能超过 128 字符")
    private String cron;

    @Size(max = 128, message = "周期描述不能超过 128 字符")
    private String period;

    private String timezone;

    @Pattern(regexp = WORKFLOW_STATUS_PATTERN, message = "工作流状态不合法")
    private String status = WORKFLOW_STATUS_PAUSED;

    @Pattern(regexp = EXECUTION_MODE_PATTERN, message = "执行模式不合法")
    private String executionMode = EXECUTION_MODE_TOPOLOGY;

    @Pattern(regexp = FAILURE_STRATEGY_PATTERN, message = "失败策略不合法")
    private String failureStrategy = FAILURE_STRATEGY_BLOCK_ALL;

    @Pattern(regexp = CONCURRENT_POLICY_PATTERN, message = "并发策略不合法")
    private String concurrentPolicy = CONCURRENT_POLICY_SERIAL_RUNS;

    private Long alertChannelId;
}
