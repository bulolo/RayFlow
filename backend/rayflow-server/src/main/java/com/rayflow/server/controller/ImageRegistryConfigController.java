package com.rayflow.server.controller;

import com.rayflow.common.result.R;
import com.rayflow.server.model.request.resource.ImageRegistryConfigRequest;
import com.rayflow.server.model.response.resource.ImageRegistryConfigResponse;
import com.rayflow.server.service.ImageRegistryConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Image Registry Management")
@RestController
@RequestMapping("/api/image-registry")
@RequiredArgsConstructor
public class ImageRegistryConfigController {

    private final ImageRegistryConfigService imageRegistryConfigService;

    @Operation(summary = "获取当前组织镜像仓库配置", operationId = "getImageRegistryConfig")
    @GetMapping
    public R<ImageRegistryConfigResponse> get() {
        return R.ok(imageRegistryConfigService.getCurrentTenantConfig());
    }

    @Operation(summary = "保存当前组织镜像仓库配置", operationId = "updateImageRegistryConfig")
    @PutMapping
    public R<ImageRegistryConfigResponse> update(@Valid @RequestBody ImageRegistryConfigRequest request) {
        return R.ok(imageRegistryConfigService.saveCurrentTenantConfig(request));
    }

    @Operation(summary = "测试镜像仓库配置", operationId = "testImageRegistryConfig")
    @PostMapping("/test")
    public R<Boolean> test(@Valid @RequestBody ImageRegistryConfigRequest request) {
        return R.ok(imageRegistryConfigService.testCurrentTenantConfig(request));
    }
}
