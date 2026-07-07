package com.rayflow.server.model.response.resource;

import com.rayflow.server.model.entity.FlussCluster;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class FlussClusterResponse {

    private Long id;
    private String clusterName;
    private String bootstrapServers;
    private String defaultDatabase;
    private String status;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static FlussClusterResponse from(FlussCluster cluster) {
        return FlussClusterResponse.builder()
                .id(cluster.getId())
                .clusterName(cluster.getClusterName())
                .bootstrapServers(cluster.getBootstrapServers())
                .defaultDatabase(cluster.getDefaultDatabase())
                .status(cluster.getStatus())
                .description(cluster.getDescription())
                .createdAt(cluster.getCreatedAt())
                .updatedAt(cluster.getUpdatedAt())
                .build();
    }
}
