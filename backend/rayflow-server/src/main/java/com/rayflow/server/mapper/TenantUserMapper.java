package com.rayflow.server.mapper;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.rayflow.server.model.response.tenant.TenantUserResponse;
import com.rayflow.server.model.entity.TenantUser;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface TenantUserMapper extends BaseMapper<TenantUser> {

    @Select("""
            <script>
            SELECT
              u.id,
              tu.tenant_id AS tenantId,
              u.username,
              u.nickname,
              u.email,
              tu.tenant_role AS role,
              u.status,
              u.last_login_at AS lastLoginAt,
              u.created_at AS createdAt,
              u.updated_at AS updatedAt
            FROM rf_tenant_user tu
            JOIN rf_user u ON u.id = tu.user_id AND u.deleted = 0
            WHERE tu.deleted = 0
              AND tu.tenant_id = #{tenantId}
              AND UPPER(u.role) &lt;&gt; 'SUPER_ADMIN'
              <if test="keyword != null and keyword != ''">
                AND (
                  LOWER(u.username) LIKE CONCAT('%', LOWER(#{keyword}), '%')
                  OR LOWER(COALESCE(u.nickname, '')) LIKE CONCAT('%', LOWER(#{keyword}), '%')
                  OR LOWER(COALESCE(u.email, '')) LIKE CONCAT('%', LOWER(#{keyword}), '%')
                  OR LOWER(COALESCE(tu.tenant_role, '')) LIKE CONCAT('%', LOWER(#{keyword}), '%')
                )
              </if>
            ORDER BY u.created_at DESC, u.id DESC
            </script>
            """)
    List<TenantUserResponse> listUsersByTenantId(
            @Param("tenantId") Long tenantId,
            @Param("keyword") String keyword
    );

    @Select("""
            <script>
            SELECT
              u.id,
              tu.tenant_id AS tenantId,
              u.username,
              u.nickname,
              u.email,
              tu.tenant_role AS role,
              u.status,
              u.last_login_at AS lastLoginAt,
              u.created_at AS createdAt,
              u.updated_at AS updatedAt
            FROM rf_tenant_user tu
            JOIN rf_user u ON u.id = tu.user_id AND u.deleted = 0
            WHERE tu.deleted = 0
              AND tu.tenant_id = #{tenantId}
              AND UPPER(u.role) &lt;&gt; 'SUPER_ADMIN'
              <if test="keyword != null and keyword != ''">
                AND (
                  LOWER(u.username) LIKE CONCAT('%', LOWER(#{keyword}), '%')
                  OR LOWER(COALESCE(u.nickname, '')) LIKE CONCAT('%', LOWER(#{keyword}), '%')
                  OR LOWER(COALESCE(u.email, '')) LIKE CONCAT('%', LOWER(#{keyword}), '%')
                  OR LOWER(COALESCE(tu.tenant_role, '')) LIKE CONCAT('%', LOWER(#{keyword}), '%')
                )
              </if>
            ORDER BY u.created_at DESC, u.id DESC
            </script>
            """)
    IPage<TenantUserResponse> pageUsersByTenantId(
            Page<TenantUserResponse> page,
            @Param("tenantId") Long tenantId,
            @Param("keyword") String keyword
    );
}
