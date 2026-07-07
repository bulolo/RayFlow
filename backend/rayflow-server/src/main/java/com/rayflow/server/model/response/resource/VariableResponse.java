package com.rayflow.server.model.response.resource;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class VariableResponse {

    private Long id;

    private String variableName;

    private String variableValue;

    private String description;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
