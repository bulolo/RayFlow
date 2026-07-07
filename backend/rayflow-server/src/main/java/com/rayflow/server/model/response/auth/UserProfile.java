package com.rayflow.server.model.response.auth;

import com.rayflow.server.model.entity.User;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 当前用户视图
 */
@Data
@Builder
public class UserProfile {

    private Long id;
    private String username;
    private String nickname;
    private String email;
    private String role;
    private Integer status;
    private LocalDateTime lastLoginAt;

    public static UserProfile from(User user) {
        return UserProfile.builder()
                .id(user.getId())
                .username(user.getUsername())
                .nickname(user.getNickname())
                .email(user.getEmail())
                .role(user.getRole())
                .status(user.getStatus())
                .lastLoginAt(user.getLastLoginAt())
                .build();
    }
}
