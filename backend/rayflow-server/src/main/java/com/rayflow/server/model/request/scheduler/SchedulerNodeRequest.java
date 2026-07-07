package com.rayflow.server.model.request.scheduler;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import static com.rayflow.server.model.enums.SchedulerConstants.TIMEOUT_POLICY_ALARM_ONLY;
import static com.rayflow.server.model.enums.SchedulerConstants.TIMEOUT_POLICY_PATTERN;

@Data
public class SchedulerNodeRequest {

    @NotBlank(message = "节点标识不能为空")
    @Size(max = 64, message = "节点标识不能超过 64 字符")
    private String nodeKey;

    @NotNull(message = "Flink 作业 ID 不能为空")
    private Long flinkJobId;

    @Min(value = 0, message = "最大重试次数不能小于 0")
    private Integer maxRetries = 0;

    @Min(value = 1, message = "重试间隔不能小于 1 秒")
    private Integer retryInterval = 60;

    @Min(value = 0, message = "超时时间不能小于 0")
    private Integer timeoutMinutes = 0;

    @Pattern(regexp = TIMEOUT_POLICY_PATTERN, message = "超时策略不合法")
    private String onTimeout = TIMEOUT_POLICY_ALARM_ONLY;

    @Min(value = 0, message = "节点 X 坐标不能小于 0")
    private Integer positionX = 40;

    @Min(value = 0, message = "节点 Y 坐标不能小于 0")
    private Integer positionY = 80;
}
