package com.rayflow.server.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 用户实体
 */
@Data
@TableName("rf_user")
public class User {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 用户名 */
    private String username;

    /** 密码 (BCrypt) */
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    /** 昵称 */
    private String nickname;

    /** 邮箱 */
    private String email;

    /** 平台角色: SUPER_ADMIN / USER */
    private String role;

    /** 状态: 0-禁用 1-正常 */
    private Integer status;

    /** 最后登录时间 */
    private LocalDateTime lastLoginAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
