package com.rayflow.server.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.rayflow.common.result.R;
import com.rayflow.server.model.request.tenant.TenantRequest;
import com.rayflow.server.model.response.tenant.TenantResponse;
import com.rayflow.server.model.entity.Tenant;
import com.rayflow.server.model.entity.User;
import com.rayflow.server.model.vo.PageResponse;
import com.rayflow.server.service.TenantAccessService;
import com.rayflow.server.service.TenantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class TenantController {

    private final TenantService tenantService;
    private final TenantAccessService tenantAccessService;

    @Tag(name = "Tenant Management")
    @Operation(summary = "获取当前用户的组织列表", operationId = "listMyTenants")
    @GetMapping("/api/tenants/my")
    public R<PageResponse<TenantResponse>> myTenants(
            @RequestParam(name = "is_pager", defaultValue = "0") int isPager,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword) {
        User user = tenantAccessService.requireCurrentUser();
        if (isPager != 1) {
            return R.ok(PageResponse.of(tenantService.listMyTenantResponses(user.getId(), keyword)));
        }
        IPage<TenantResponse> tenants = tenantService.pageMyTenantResponses(
                user.getId(),
                new Page<>(Math.max(page, 1), Math.max(size, 1)),
                keyword
        );
        return R.ok(PageResponse.from(tenants));
    }

    @Tag(name = "Platform Tenant Management")
    @Operation(summary = "获取平台组织列表", operationId = "listPlatformTenants")
    @GetMapping("/api/platform/tenants")
    public R<PageResponse<TenantResponse>> listPlatformTenants(
            @RequestParam(name = "is_pager", defaultValue = "0") int isPager,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword) {
        tenantAccessService.requirePlatformAdmin();
        if (isPager != 1) {
            return R.ok(PageResponse.of(tenantService.listPlatformTenantResponses(keyword)));
        }
        IPage<TenantResponse> tenants = tenantService.pagePlatformTenantResponses(
                new Page<>(Math.max(page, 1), Math.max(size, 1)),
                keyword
        );
        return R.ok(PageResponse.from(tenants));
    }

    @Tag(name = "Platform Tenant Management")
    @Operation(summary = "创建平台组织", operationId = "createPlatformTenant")
    @PostMapping("/api/platform/tenants")
    public R<TenantResponse> createPlatformTenant(@Valid @RequestBody TenantRequest request) {
        User user = tenantAccessService.requireCurrentUser();
        tenantAccessService.requirePlatformAdmin();
        Tenant tenant = tenantService.createTenant(request, user.getId());
        return R.ok(TenantResponse.from(tenant));
    }

    @Tag(name = "Platform Tenant Management")
    @Operation(summary = "更新平台组织", operationId = "updatePlatformTenant")
    @PutMapping("/api/platform/tenants/{id}")
    public R<TenantResponse> updatePlatformTenant(@PathVariable Long id, @Valid @RequestBody TenantRequest request) {
        tenantAccessService.requirePlatformAdmin();
        return R.ok(TenantResponse.from(tenantService.updateTenant(id, request)));
    }

    @Tag(name = "Platform Tenant Management")
    @Operation(summary = "删除平台组织", operationId = "deletePlatformTenant")
    @DeleteMapping("/api/platform/tenants/{id}")
    public R<Void> deletePlatformTenant(@PathVariable Long id) {
        tenantAccessService.requirePlatformAdmin();
        tenantService.deleteTenant(id);
        return R.ok();
    }
}
