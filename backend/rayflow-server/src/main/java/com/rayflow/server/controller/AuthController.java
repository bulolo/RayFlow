package com.rayflow.server.controller;

import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.R;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.model.request.auth.LoginRequest;
import com.rayflow.server.model.response.auth.LoginResponse;
import com.rayflow.server.model.response.auth.UserProfile;
import com.rayflow.server.model.entity.User;
import com.rayflow.server.service.JwtService;
import com.rayflow.server.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

/**
 * 认证接口
 */
@Tag(name = "Auth")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Operation(summary = "登录", operationId = "login")
    @PostMapping("/login")
    public R<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        User user = userService.findActiveByUsername(request.getUsername());
        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }

        LocalDateTime lastLoginAt = LocalDateTime.now();
        user.setLastLoginAt(lastLoginAt);
        userService.updateLastLoginAt(user.getId(), lastLoginAt);

        String token = jwtService.generateToken(user.getUsername(), user.getRole());
        return R.ok(LoginResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiresIn(jwtService.getExpirationMs() / 1000)
                .user(UserProfile.from(user))
                .build());
    }

    @Operation(summary = "当前用户", operationId = "getCurrentUser")
    @GetMapping("/me")
    public R<UserProfile> me(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        User user = userService.findActiveByUsername(authentication.getName());
        if (user == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        return R.ok(UserProfile.from(user));
    }

    @Operation(summary = "退出登录", operationId = "logout")
    @PostMapping("/logout")
    public R<Void> logout() {
        return R.ok();
    }
}
