package com.rayflow.server.model.response.resource;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
public class NotificationChannelResponse {

    private Long id;

    private String name;

    private String type;

    private Map<String, String> config;

    private Boolean enabled;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
