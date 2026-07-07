package com.rayflow.server.model.response.auth;

import lombok.Builder;
import lombok.Data;

/**
 * 登录响应
 */
@Data
@Builder
public class LoginResponse {

    private String token;
    private String tokenType;
    private Long expiresIn;
    private UserProfile user;
}
