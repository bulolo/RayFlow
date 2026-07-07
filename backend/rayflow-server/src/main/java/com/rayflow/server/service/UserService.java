package com.rayflow.server.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.rayflow.server.mapper.UserMapper;
import com.rayflow.server.model.entity.User;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * 用户服务
 */
@Service
public class UserService extends ServiceImpl<UserMapper, User> {

    public User findByUsername(String username) {
        return this.getOne(Wrappers.<User>lambdaQuery()
                .eq(User::getUsername, username)
                .last("LIMIT 1"));
    }

    public User findActiveByUsername(String username) {
        return this.getOne(Wrappers.<User>lambdaQuery()
                .eq(User::getUsername, username)
                .eq(User::getStatus, 1)
                .last("LIMIT 1"));
    }

    public void updateLastLoginAt(Long userId, LocalDateTime lastLoginAt) {
        lambdaUpdate()
                .eq(User::getId, userId)
                .set(User::getLastLoginAt, lastLoginAt)
                .update();
    }
}
