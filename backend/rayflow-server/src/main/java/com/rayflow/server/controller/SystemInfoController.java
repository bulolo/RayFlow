package com.rayflow.server.controller;

import com.rayflow.common.result.R;
import com.rayflow.server.model.response.system.SystemInfoResponse;
import com.rayflow.server.service.SystemInfoService;
import com.rayflow.server.service.TenantAccessService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Platform System")
@RestController
@RequiredArgsConstructor
public class SystemInfoController {

    private final TenantAccessService tenantAccessService;
    private final SystemInfoService systemInfoService;

    @Operation(summary = "获取平台系统信息", operationId = "getPlatformSystemInfo")
    @GetMapping("/api/platform/system-info")
    public R<SystemInfoResponse> getPlatformSystemInfo() {
        tenantAccessService.requirePlatformAdmin();
        return R.ok(systemInfoService.getSystemInfo());
    }
}
