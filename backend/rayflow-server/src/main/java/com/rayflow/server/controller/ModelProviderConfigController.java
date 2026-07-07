package com.rayflow.server.controller;

import com.rayflow.common.result.R;
import com.rayflow.server.model.request.resource.ModelProviderConfigRequest;
import com.rayflow.server.model.response.resource.ModelProviderConfigResponse;
import com.rayflow.server.service.ModelProviderConfigService;
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

@Tag(name = "Model Provider Management")
@RestController
@RequestMapping("/api/model-provider")
@RequiredArgsConstructor
public class ModelProviderConfigController {

    private final ModelProviderConfigService modelProviderConfigService;

    @Operation(summary = "获取当前组织模型提供商配置", operationId = "getModelProviderConfig")
    @GetMapping
    public R<ModelProviderConfigResponse> get() {
        return R.ok(modelProviderConfigService.getCurrentTenantConfig());
    }

    @Operation(summary = "保存当前组织模型提供商配置", operationId = "updateModelProviderConfig")
    @PutMapping
    public R<ModelProviderConfigResponse> update(@Valid @RequestBody ModelProviderConfigRequest request) {
        return R.ok(modelProviderConfigService.saveCurrentTenantConfig(request));
    }

    @Operation(summary = "测试模型提供商配置", operationId = "testModelProviderConfig")
    @PostMapping("/test")
    public R<Boolean> test(@Valid @RequestBody ModelProviderConfigRequest request) {
        return R.ok(modelProviderConfigService.testCurrentTenantConfig(request));
    }
}
