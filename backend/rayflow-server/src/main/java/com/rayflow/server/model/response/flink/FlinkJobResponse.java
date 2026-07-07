package com.rayflow.server.model.response.flink;

import com.rayflow.server.model.entity.FlinkJob;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FlinkJobResponse {

    private Long id;
    private String jobName;
    private String jobGroup;
    private String jobType;
    private String runtimeMode;
    private String submitType;
    private String executionMode;
    private Long clusterId;
    private Long currentExecutionId;
    private String flinkJobId;
    private String status;
    private String publishStatus;
    private String content;
    private String mainClass;
    private String args;
    private String flinkConfig;
    private Integer parallelism;
    private String savepointPath;
    private String applicationImage;
    private String jarUri;
    private String dependencyRefs;
    private String description;
    private String jobTags;
    private String docUrl;
    private Long alertChannelId;
    private String alertRule;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static FlinkJobResponse from(FlinkJob job) {
        return FlinkJobResponse.builder()
                .id(job.getId())
                .jobName(job.getJobName())
                .jobGroup(job.getJobGroup())
                .jobType(job.getJobType())
                .runtimeMode(job.getRuntimeMode())
                .submitType(job.getSubmitType())
                .executionMode(job.getExecutionMode())
                .clusterId(job.getClusterId())
                .currentExecutionId(job.getCurrentExecutionId())
                .flinkJobId(job.getFlinkJobId())
                .status(job.getStatus())
                .publishStatus(job.getPublishStatus())
                .content(job.getContent())
                .mainClass(job.getMainClass())
                .args(job.getArgs())
                .flinkConfig(job.getFlinkConfig())
                .parallelism(job.getParallelism())
                .savepointPath(job.getSavepointPath())
                .applicationImage(job.getApplicationImage())
                .jarUri(job.getJarUri())
                .dependencyRefs(job.getDependencyRefs())
                .description(job.getDescription())
                .jobTags(job.getJobTags())
                .docUrl(job.getDocUrl())
                .alertChannelId(job.getAlertChannelId())
                .alertRule(job.getAlertRule())
                .createdAt(job.getCreatedAt())
                .updatedAt(job.getUpdatedAt())
                .build();
    }
}
