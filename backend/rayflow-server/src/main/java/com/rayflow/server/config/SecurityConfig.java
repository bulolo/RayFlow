package com.rayflow.server.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rayflow.common.result.R;
import com.rayflow.common.result.ResultCode;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Spring Security 配置
 * 初始阶段放行所有接口，后续逐步加固
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final ObjectMapper objectMapper;
    private static final MediaType APPLICATION_JSON_UTF8 = new MediaType("application", "json", java.nio.charset.StandardCharsets.UTF_8);

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(exception -> exception
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(HttpStatus.UNAUTHORIZED.value());
                    response.setContentType(APPLICATION_JSON_UTF8.toString());
                    objectMapper.writeValue(response.getWriter(), R.fail(
                            ResultCode.UNAUTHORIZED.getCode(),
                            ResultCode.UNAUTHORIZED.getMessage()
                    ));
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    response.setStatus(HttpStatus.FORBIDDEN.value());
                    response.setContentType(APPLICATION_JSON_UTF8.toString());
                    objectMapper.writeValue(response.getWriter(), R.fail(
                            ResultCode.FORBIDDEN.getCode(),
                            ResultCode.FORBIDDEN.getMessage()
                    ));
                })
            )
            .authorizeHttpRequests(auth -> auth
                // 放行健康检查和 API 文档
                .requestMatchers("/api/health", "/doc.html", "/webjars/**", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                .requestMatchers("/api/auth/login").permitAll()
                .requestMatchers("/api/**").authenticated()
                .anyRequest().permitAll()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
