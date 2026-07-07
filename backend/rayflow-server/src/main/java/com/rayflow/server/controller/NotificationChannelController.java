package com.rayflow.server.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.rayflow.common.result.R;
import com.rayflow.server.model.request.resource.NotificationChannelRequest;
import com.rayflow.server.model.response.resource.NotificationChannelResponse;
import com.rayflow.server.model.entity.NotificationChannel;
import com.rayflow.server.model.vo.PageResponse;
import com.rayflow.server.service.NotificationChannelService;
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

@Tag(name = "Notification Channel Management")
@RestController
@RequestMapping("/api/notification-channels")
@RequiredArgsConstructor
public class NotificationChannelController {

    private final NotificationChannelService notificationChannelService;

    @Operation(summary = "获取当前组织告警渠道列表", operationId = "listNotificationChannels")
    @GetMapping
    public R<PageResponse<NotificationChannelResponse>> list(
            @RequestParam(name = "is_pager", defaultValue = "0") int isPager,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword) {
        if (isPager != 1) {
            return R.ok(PageResponse.of(notificationChannelService.listCurrentTenantChannels(keyword)));
        }
        IPage<NotificationChannel> channels = notificationChannelService.pageCurrentTenantChannels(
                new Page<>(Math.max(page, 1), Math.max(size, 1)),
                keyword
        );
        return R.ok(PageResponse.from(channels, notificationChannelService::toResponse));
    }

    @Operation(summary = "创建告警渠道", operationId = "createNotificationChannel")
    @PostMapping
    public R<NotificationChannelResponse> create(@Valid @RequestBody NotificationChannelRequest request) {
        return R.ok(notificationChannelService.createChannel(request));
    }

    @Operation(summary = "更新告警渠道", operationId = "updateNotificationChannel")
    @PutMapping("/{id}")
    public R<NotificationChannelResponse> update(@PathVariable Long id, @Valid @RequestBody NotificationChannelRequest request) {
        return R.ok(notificationChannelService.updateChannel(id, request));
    }

    @Operation(summary = "删除告警渠道", operationId = "deleteNotificationChannel")
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable Long id) {
        notificationChannelService.deleteChannel(id);
        return R.ok();
    }

    @Operation(summary = "发送测试告警", operationId = "testNotificationChannel")
    @PostMapping("/{id}:test")
    public R<Boolean> test(@PathVariable Long id) {
        return R.ok(notificationChannelService.testChannel(id));
    }
}
