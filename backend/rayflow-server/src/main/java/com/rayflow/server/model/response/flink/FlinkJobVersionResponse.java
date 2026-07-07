package com.rayflow.server.model.response.flink;

import com.rayflow.server.model.entity.FlinkJobVersion;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class FlinkJobVersionResponse {

    private Long id;
    private Long jobId;
    private Integer versionNo;
    private String versionName;
    private String remark;
    private LocalDateTime createdAt;

    public static FlinkJobVersionResponse from(FlinkJobVersion version) {
        return FlinkJobVersionResponse.builder()
                .id(version.getId())
                .jobId(version.getJobId())
                .versionNo(version.getVersionNo())
                .versionName(version.getVersionName())
                .remark(version.getRemark())
                .createdAt(version.getCreatedAt())
                .build();
    }
}
