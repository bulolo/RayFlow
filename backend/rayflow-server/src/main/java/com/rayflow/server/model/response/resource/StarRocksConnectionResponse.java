package com.rayflow.server.model.response.resource;

import com.rayflow.server.model.entity.StarRocksConnection;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class StarRocksConnectionResponse {

    private Long id;
    private String connectionName;
    private String feAddress;
    private Integer queryPort;
    private String username;
    private String defaultDatabase;
    private String status;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static StarRocksConnectionResponse from(StarRocksConnection connection) {
        return StarRocksConnectionResponse.builder()
                .id(connection.getId())
                .connectionName(connection.getConnectionName())
                .feAddress(connection.getFeAddress())
                .queryPort(connection.getQueryPort())
                .username(connection.getUsername())
                .defaultDatabase(connection.getDefaultDatabase())
                .status(connection.getStatus())
                .description(connection.getDescription())
                .createdAt(connection.getCreatedAt())
                .updatedAt(connection.getUpdatedAt())
                .build();
    }
}
