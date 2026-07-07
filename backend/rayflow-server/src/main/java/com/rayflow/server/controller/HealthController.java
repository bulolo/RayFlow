package com.rayflow.server.controller;

import com.rayflow.common.result.R;
import com.rayflow.server.model.response.system.HealthResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 健康检查
 */
@Tag(name = "System")
@RestController
public class HealthController {

    @Value("${rayflow.version:0.0.5}")
    private String version;

    @Operation(summary = "健康检查", operationId = "getHealth")
    @GetMapping("/api/health")
    public R<HealthResponse> health() {
        return R.ok(new HealthResponse("UP", "RayFlow", version));
    }
}
