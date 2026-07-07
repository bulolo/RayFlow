package com.rayflow.server.controller;

import com.rayflow.common.result.R;
import com.rayflow.server.model.request.system.SystemDefaultsRequest;
import com.rayflow.server.model.response.system.SystemDefaultsResponse;
import com.rayflow.server.service.SystemDefaultsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "System")
@RestController
@RequestMapping("/api/system")
@RequiredArgsConstructor
public class SystemDefaultsController {

    private final SystemDefaultsService systemDefaultsService;

    @Operation(summary = "获取系统默认设置", operationId = "getSystemDefaults")
    @GetMapping("/defaults")
    public R<SystemDefaultsResponse> getDefaults() {
        return R.ok(systemDefaultsService.getCurrentTenantDefaults());
    }

    @Operation(summary = "更新系统默认设置", operationId = "updateSystemDefaults")
    @PutMapping("/defaults")
    public R<SystemDefaultsResponse> updateDefaults(@Valid @RequestBody SystemDefaultsRequest request) {
        return R.ok(systemDefaultsService.updateCurrentTenantDefaults(request));
    }
}
