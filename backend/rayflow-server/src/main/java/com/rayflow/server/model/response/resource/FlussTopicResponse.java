package com.rayflow.server.model.response.resource;

import com.rayflow.server.model.entity.FlussTopic;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class FlussTopicResponse {

    private Long id;
    private Long clusterId;
    private String topicName;
    private String namespaceName;
    private Integer bucketCount;
    private Integer replicationFactor;
    private String status;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static FlussTopicResponse from(FlussTopic topic) {
        return FlussTopicResponse.builder()
                .id(topic.getId())
                .clusterId(topic.getClusterId())
                .topicName(topic.getTopicName())
                .namespaceName(topic.getNamespaceName())
                .bucketCount(topic.getBucketCount())
                .replicationFactor(topic.getReplicationFactor())
                .status(topic.getStatus())
                .description(topic.getDescription())
                .createdAt(topic.getCreatedAt())
                .updatedAt(topic.getUpdatedAt())
                .build();
    }
}
