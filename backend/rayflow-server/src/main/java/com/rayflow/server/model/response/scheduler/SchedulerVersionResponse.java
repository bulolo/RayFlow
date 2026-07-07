package com.rayflow.server.model.response.scheduler;

import com.rayflow.server.model.entity.SchedulerWorkflowVersion;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class SchedulerVersionResponse {

    private Long id;
    private Long workflowId;
    private Integer versionNo;
    private String versionName;
    private String remark;
    private LocalDateTime createdAt;

    public static SchedulerVersionResponse from(SchedulerWorkflowVersion version) {
        return SchedulerVersionResponse.builder()
                .id(version.getId())
                .workflowId(version.getWorkflowId())
                .versionNo(version.getVersionNo())
                .versionName(version.getVersionName())
                .remark(version.getRemark())
                .createdAt(version.getCreatedAt())
                .build();
    }
}
