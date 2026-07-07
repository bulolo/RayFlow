package com.rayflow.server.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.R;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.model.request.tenant.UserCreateRequest;
import com.rayflow.server.model.request.tenant.UserUpdateRequest;
import com.rayflow.server.model.response.tenant.TenantUserResponse;
import com.rayflow.server.model.vo.PageResponse;
import com.rayflow.server.service.TenantAccessService;
import com.rayflow.server.service.TenantUserService;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 用户管理
 */
@Tag(name = "User Management")
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final TenantUserService tenantUserService;
    private final TenantAccessService tenantAccessService;

    @Operation(summary = "获取用户列表", operationId = "listUsers")
    @GetMapping
    public R<PageResponse<TenantUserResponse>> list(
            @RequestParam(name = "is_pager", defaultValue = "0") int isPager,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword) {
        Long tenantId = tenantAccessService.requireCurrentTenantId();
        if (isPager != 1) {
            return R.ok(PageResponse.of(tenantUserService.listUsers(tenantId, keyword)));
        }
        IPage<TenantUserResponse> users = tenantUserService.pageUsers(
                tenantId,
                new Page<>(Math.max(page, 1), Math.max(size, 1)),
                keyword
        );
        return R.ok(PageResponse.from(users));
    }

    @Operation(summary = "创建用户", operationId = "createUser")
    @PostMapping
    public R<Void> create(@Valid @RequestBody UserCreateRequest request) {
        validateStatus(request.getStatus());
        tenantUserService.createUser(tenantAccessService.requireCurrentTenantId(), request);
        return R.ok();
    }

    @Operation(summary = "更新用户", operationId = "updateUser")
    @PutMapping("/{id}")
    public R<Void> update(@PathVariable Long id, @Valid @RequestBody UserUpdateRequest request) {
        validateStatus(request.getStatus());
        tenantUserService.updateUser(tenantAccessService.requireCurrentTenantId(), id, request);
        return R.ok();
    }

    @Operation(summary = "删除用户", operationId = "deleteUser")
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable Long id) {
        tenantUserService.deleteUser(tenantAccessService.requireCurrentTenantId(), id);
        return R.ok();
    }

    private static void validateStatus(Integer status) {
        if (status != null && status != 0 && status != 1) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "用户状态仅支持 0 或 1");
        }
    }
}
