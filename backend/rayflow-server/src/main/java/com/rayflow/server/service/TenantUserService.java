package com.rayflow.server.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.mapper.TenantUserMapper;
import com.rayflow.server.model.request.tenant.UserCreateRequest;
import com.rayflow.server.model.request.tenant.UserUpdateRequest;
import com.rayflow.server.model.response.tenant.TenantUserResponse;
import com.rayflow.server.model.entity.TenantUser;
import com.rayflow.server.model.entity.User;
import com.rayflow.server.model.enums.PlatformRole;
import com.rayflow.server.model.enums.TenantRole;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TenantUserService extends ServiceImpl<TenantUserMapper, TenantUser> {
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;

    public List<TenantUserResponse> listUsers(Long tenantId, String keyword) {
        return baseMapper.listUsersByTenantId(tenantId, normalizeKeyword(keyword));
    }

    public IPage<TenantUserResponse> pageUsers(Long tenantId, Page<TenantUserResponse> page, String keyword) {
        return baseMapper.pageUsersByTenantId(page, tenantId, normalizeKeyword(keyword));
    }

    public TenantUser getRequiredMembership(Long tenantId, Long userId) {
        TenantUser tenantUser = lambdaQuery()
                .eq(TenantUser::getTenantId, tenantId)
                .eq(TenantUser::getUserId, userId)
                .last("LIMIT 1")
                .one();
        if (tenantUser == null) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "组织成员不存在");
        }
        return tenantUser;
    }

    @Transactional
    public void createUser(Long tenantId, UserCreateRequest request) {
        User user = userService.findByUsername(request.getUsername());
        if (user == null) {
            user = new User();
            user.setUsername(request.getUsername().trim());
            user.setPassword(passwordEncoder.encode(request.getPassword()));
            user.setNickname(request.getNickname());
            user.setEmail(request.getEmail());
            user.setRole(PlatformRole.USER);
            user.setStatus(request.getStatus() == null ? 1 : request.getStatus());
            userService.save(user);
        }

        boolean exists = lambdaQuery()
                .eq(TenantUser::getTenantId, tenantId)
                .eq(TenantUser::getUserId, user.getId())
                .exists();
        if (exists) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "当前用户已在该组织中");
        }

        TenantUser membership = new TenantUser();
        membership.setTenantId(tenantId);
        membership.setUserId(user.getId());
        membership.setTenantRole(normalizeRole(request.getRole()));
        save(membership);
    }

    @Transactional
    public void updateUser(Long tenantId, Long userId, UserUpdateRequest request) {
        getRequiredMembership(tenantId, userId);
        User user = userService.getById(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
        rejectPlatformSuperAdminMutation(user);
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            user.setPassword(passwordEncoder.encode(request.getPassword()));
        }
        user.setNickname(request.getNickname());
        user.setEmail(request.getEmail());
        user.setStatus(request.getStatus());
        userService.updateById(user);

        if (request.getRole() != null && !request.getRole().isBlank()) {
            lambdaUpdate()
                    .eq(TenantUser::getTenantId, tenantId)
                    .eq(TenantUser::getUserId, userId)
                    .set(TenantUser::getTenantRole, normalizeRole(request.getRole()))
                    .update();
        }
    }

    public void deleteUser(Long tenantId, Long userId) {
        getRequiredMembership(tenantId, userId);
        User user = userService.getById(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
        rejectPlatformSuperAdminMutation(user);
        lambdaUpdate()
                .eq(TenantUser::getTenantId, tenantId)
                .eq(TenantUser::getUserId, userId)
                .remove();
    }

    private static void rejectPlatformSuperAdminMutation(User user) {
        if (user != null && PlatformRole.SUPER_ADMIN.equalsIgnoreCase(user.getRole())) {
            throw new BusinessException(ResultCode.FORBIDDEN.getCode(), "平台超级管理员不在租户用户管理范围内");
        }
    }

    private static String normalizeRole(String role) {
        return role == null || role.isBlank() ? TenantRole.MEMBER : role.trim().toUpperCase();
    }

    private static String normalizeKeyword(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        return keyword.trim();
    }
}
