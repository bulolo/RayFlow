package com.rayflow.server.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.mapper.TenantMapper;
import com.rayflow.server.model.request.tenant.TenantRequest;
import com.rayflow.server.model.response.tenant.TenantResponse;
import com.rayflow.server.model.entity.Tenant;
import com.rayflow.server.model.entity.TenantUser;
import com.rayflow.server.model.entity.User;
import com.rayflow.server.model.enums.PlatformRole;
import com.rayflow.server.model.enums.TenantRole;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TenantService extends ServiceImpl<TenantMapper, Tenant> {
    private final TenantUserService tenantUserService;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;

    public List<Tenant> listMyTenants(Long userId) {
        User user = userService.getById(userId);
        if (isPlatformAdmin(user)) {
            return lambdaQuery()
                    .orderByAsc(Tenant::getId)
                    .list();
        }
        List<Long> tenantIds = tenantIdsForUser(userId);
        if (tenantIds.isEmpty()) {
            return List.of();
        }
        return lambdaQuery()
                .in(Tenant::getId, tenantIds)
                .orderByAsc(Tenant::getId)
                .list();
    }

    public List<TenantResponse> listMyTenantResponses(Long userId, String keyword) {
        return buildTenantQuery(userId, keyword)
                .list()
                .stream()
                .map(TenantResponse::from)
                .toList();
    }

    public IPage<TenantResponse> pageMyTenantResponses(Long userId, Page<Tenant> page, String keyword) {
        return buildTenantQuery(userId, keyword)
                .page(page)
                .convert(TenantResponse::from);
    }

    public List<TenantResponse> listPlatformTenantResponses(String keyword) {
        return buildPlatformTenantQuery(keyword)
                .list()
                .stream()
                .map(TenantResponse::from)
                .toList();
    }

    public IPage<TenantResponse> pagePlatformTenantResponses(Page<Tenant> page, String keyword) {
        return buildPlatformTenantQuery(keyword)
                .page(page)
                .convert(TenantResponse::from);
    }

    public Tenant getRequiredById(Long id) {
        Tenant tenant = getById(id);
        if (tenant == null) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
        return tenant;
    }

    public Tenant resolveTenantForUser(Long userId, String slug) {
        List<Tenant> tenants = listMyTenants(userId);
        if (tenants.isEmpty()) {
            throw new BusinessException(ResultCode.FORBIDDEN.getCode(), "当前账号尚未加入任何组织");
        }
        if (slug == null || slug.isBlank()) {
            return tenants.get(0);
        }
        return tenants.stream()
                .filter(item -> slug.equals(item.getTenantSlug()))
                .findFirst()
                .orElseThrow(() -> new BusinessException(ResultCode.FORBIDDEN.getCode(), "无权访问当前组织"));
    }

    @Transactional
    public Tenant createTenant(TenantRequest request, Long operatorUserId) {
        validateUnique(request.getTenantName(), request.getTenantSlug(), null);
        Tenant tenant = new Tenant();
        tenant.setTenantName(request.getTenantName().trim());
        tenant.setTenantSlug(request.getTenantSlug().trim());
        tenant.setStatus(normalizeStatus(request.getStatus()));
        tenant.setDescription(request.getDescription());
        save(tenant);

        Long membershipUserId = resolveInitialTenantAdminUserId(request, operatorUserId);
        if (membershipUserId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "缺少初始租户管理员，无法初始化组织成员");
        }
        TenantUser membership = new TenantUser();
        membership.setTenantId(tenant.getId());
        membership.setUserId(membershipUserId);
        membership.setTenantRole(TenantRole.ADMIN);
        tenantUserService.save(membership);
        return tenant;
    }

    public Tenant updateTenant(Long id, TenantRequest request) {
        Tenant tenant = getRequiredById(id);
        validateUnique(request.getTenantName(), request.getTenantSlug(), id);
        tenant.setTenantName(request.getTenantName().trim());
        tenant.setTenantSlug(request.getTenantSlug().trim());
        tenant.setStatus(normalizeStatus(request.getStatus()));
        tenant.setDescription(request.getDescription());
        updateById(tenant);
        return tenant;
    }

    public void deleteTenant(Long id) {
        if (!removeById(id)) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
    }

    private com.baomidou.mybatisplus.extension.conditions.query.LambdaQueryChainWrapper<Tenant> buildTenantQuery(Long userId, String keyword) {
        User user = userService.getById(userId);
        String normalizedKeyword = normalizeKeyword(keyword);
        var query = lambdaQuery()
                .and(StringUtils.hasText(normalizedKeyword), wrapper -> wrapper
                        .like(Tenant::getTenantName, normalizedKeyword)
                        .or()
                        .like(Tenant::getTenantSlug, normalizedKeyword)
                        .or()
                        .like(Tenant::getDescription, normalizedKeyword)
                        .or()
                        .like(Tenant::getStatus, normalizedKeyword))
                .orderByAsc(Tenant::getId);
        if (!isPlatformAdmin(user)) {
            List<Long> tenantIds = tenantIdsForUser(userId);
            if (tenantIds.isEmpty()) {
                query.eq(Tenant::getId, -1L);
            } else {
                query.in(Tenant::getId, tenantIds);
            }
        }
        return query;
    }

    private List<Long> tenantIdsForUser(Long userId) {
        if (userId == null) {
            return List.of();
        }
        return tenantUserService.lambdaQuery()
                .eq(TenantUser::getUserId, userId)
                .list()
                .stream()
                .map(TenantUser::getTenantId)
                .distinct()
                .toList();
    }

    private com.baomidou.mybatisplus.extension.conditions.query.LambdaQueryChainWrapper<Tenant> buildPlatformTenantQuery(String keyword) {
        String normalizedKeyword = normalizeKeyword(keyword);
        return lambdaQuery()
                .and(StringUtils.hasText(normalizedKeyword), wrapper -> wrapper
                        .like(Tenant::getTenantName, normalizedKeyword)
                        .or()
                        .like(Tenant::getTenantSlug, normalizedKeyword)
                        .or()
                        .like(Tenant::getDescription, normalizedKeyword)
                        .or()
                        .like(Tenant::getStatus, normalizedKeyword))
                .orderByAsc(Tenant::getId);
    }

    private void validateUnique(String tenantName, String tenantSlug, Long currentId) {
        long sameName = lambdaQuery()
                .eq(Tenant::getTenantName, tenantName.trim())
                .ne(currentId != null, Tenant::getId, currentId)
                .count();
        if (sameName > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "组织名称已存在");
        }

        long sameSlug = lambdaQuery()
                .eq(Tenant::getTenantSlug, tenantSlug.trim())
                .ne(currentId != null, Tenant::getId, currentId)
                .count();
        if (sameSlug > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "组织标识已存在");
        }
    }

    private static String normalizeStatus(String status) {
        return status == null || status.isBlank() ? "ACTIVE" : status.trim().toUpperCase();
    }

    private Long resolveInitialTenantAdminUserId(TenantRequest request, Long operatorUserId) {
        User operator = userService.getById(operatorUserId);
        if (operator == null) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "创建组织的操作用户不存在");
        }
        if (!isPlatformAdmin(operator)) {
            return operator.getId();
        }

        return createInitialTenantAdmin(request).getId();
    }

    private User createInitialTenantAdmin(TenantRequest request) {
        String adminUsername = normalizeRequiredValue(request.getAdminUsername(), "平台创建组织时必须填写初始租户管理员用户名");
        String adminPassword = normalizeRequiredValue(request.getAdminPassword(), "平台创建组织时必须填写初始租户管理员密码");

        User existing = userService.findByUsername(adminUsername);
        if (existing != null) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "初始租户管理员用户名已存在，请更换后重试");
        }

        User tenantAdmin = new User();
        tenantAdmin.setUsername(adminUsername);
        tenantAdmin.setPassword(passwordEncoder.encode(adminPassword));
        tenantAdmin.setNickname(normalizeOptionalValue(request.getAdminNickname()));
        tenantAdmin.setEmail(normalizeOptionalValue(request.getAdminEmail()));
        tenantAdmin.setRole(PlatformRole.USER);
        tenantAdmin.setStatus(1);
        userService.save(tenantAdmin);
        return tenantAdmin;
    }

    private static String normalizeRequiredValue(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), message);
        }
        return value.trim();
    }

    private static String normalizeOptionalValue(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static String normalizeKeyword(String keyword) {
        if (keyword == null) {
            return null;
        }
        String normalized = keyword.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static boolean isPlatformAdmin(User user) {
        return user != null && PlatformRole.SUPER_ADMIN.equalsIgnoreCase(user.getRole());
    }
}
