package com.rayflow.server.model.response.system;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class HealthResponse {
    private String status;
    private String app;
    private String version;
}
