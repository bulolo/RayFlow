package com.rayflow.server.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.mapper.NotificationChannelMapper;
import com.rayflow.server.model.request.resource.NotificationChannelRequest;
import com.rayflow.server.model.response.resource.NotificationChannelResponse;
import com.rayflow.server.model.entity.NotificationChannel;
import com.rayflow.server.security.SecretCipher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationChannelService extends ServiceImpl<NotificationChannelMapper, NotificationChannel> {

    private static final TypeReference<Map<String, String>> STRING_MAP = new TypeReference<>() {};

    private final TenantAccessService tenantAccessService;
    private final ObjectMapper objectMapper;
    private final SecretCipher secretCipher;

    public List<NotificationChannelResponse> listCurrentTenantChannels(String keyword) {
        return listCurrentTenantChannelEntities(keyword).stream()
                .map(this::toResponse)
                .toList();
    }

    public IPage<NotificationChannel> pageCurrentTenantChannels(Page<NotificationChannel> page, String keyword) {
        return buildTenantChannelQuery(keyword)
                .page(page);
    }

    public NotificationChannelResponse toResponse(NotificationChannel entity) {
        NotificationChannelResponse response = new NotificationChannelResponse();
        response.setId(entity.getId());
        response.setName(entity.getName());
        response.setType(entity.getType());
        response.setConfig(maskSecret(readConfig(entity.getConfigJson())));
        response.setEnabled(entity.getEnabled() == null || entity.getEnabled() == 1);
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        return response;
    }

    public NotificationChannelResponse createChannel(NotificationChannelRequest request) {
        Long tenantId = tenantAccessService.requireCurrentTenantId();
        validateUniqueName(request.getName(), tenantId, null);
        validateRequest(request, false);

        NotificationChannel entity = new NotificationChannel();
        entity.setName(request.getName().trim());
        entity.setType(request.getType().trim());
        entity.setConfigJson(writeConfig(request.getConfig()));
        entity.setEnabled(Boolean.TRUE.equals(request.getEnabled()) ? 1 : 0);
        entity.setTenantId(tenantId);
        save(entity);
        return toResponse(entity);
    }

    public NotificationChannelResponse updateChannel(Long id, NotificationChannelRequest request) {
        NotificationChannel existing = getRequired(id);
        validateUniqueName(request.getName(), existing.getTenantId(), id);
        validateRequest(request, true);

        Map<String, String> mergedConfig = mergeConfig(existing, request);
        existing.setName(request.getName().trim());
        existing.setType(request.getType().trim());
        existing.setConfigJson(writeConfig(mergedConfig));
        existing.setEnabled(Boolean.TRUE.equals(request.getEnabled()) ? 1 : 0);
        updateById(existing);
        return toResponse(existing);
    }

    public void deleteChannel(Long id) {
        NotificationChannel channel = getRequired(id);
        removeById(channel.getId());
    }

    public boolean testChannel(Long id) {
        NotificationChannel channel = getRequired(id);
        if (channel.getEnabled() != null && channel.getEnabled() == 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "渠道已停用，无法测试");
        }
        return sendTestMessage(channel);
    }

    public NotificationChannel getRequired(Long id) {
        NotificationChannel channel = lambdaQuery()
                .eq(NotificationChannel::getId, id)
                .eq(NotificationChannel::getTenantId, tenantAccessService.requireCurrentTenantId())
                .last("LIMIT 1")
                .one();
        if (channel == null) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
        return channel;
    }

    private List<NotificationChannel> listCurrentTenantChannelEntities(String keyword) {
        return buildTenantChannelQuery(keyword).list();
    }

    private com.baomidou.mybatisplus.extension.conditions.query.LambdaQueryChainWrapper<NotificationChannel> buildTenantChannelQuery(String keyword) {
        String normalizedKeyword = normalizeKeyword(keyword);
        return lambdaQuery()
                .eq(NotificationChannel::getTenantId, tenantAccessService.requireCurrentTenantId())
                .and(StringUtils.hasText(normalizedKeyword), wrapper -> wrapper
                        .like(NotificationChannel::getName, normalizedKeyword)
                        .or()
                        .like(NotificationChannel::getType, normalizedKeyword))
                .orderByDesc(NotificationChannel::getId);
    }

    private void validateUniqueName(String name, Long tenantId, Long currentId) {
        long count = lambdaQuery()
                .eq(NotificationChannel::getTenantId, tenantId)
                .eq(NotificationChannel::getName, name.trim())
                .ne(currentId != null, NotificationChannel::getId, currentId)
                .count();
        if (count > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "渠道名称已存在");
        }
    }

    private void validateRequest(NotificationChannelRequest request, boolean updating) {
        String type = request.getType().trim();
        Map<String, String> config = request.getConfig() == null ? Map.of() : request.getConfig();
        boolean needsWebhook = !"inapp".equals(type);
        if (needsWebhook && !StringUtils.hasText(config.get("webhook_url"))) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Webhook 地址不能为空");
        }
        if ("dingtalk".equals(type) && updating && config.containsKey("secret") && config.get("secret") != null && config.get("secret").isBlank()) {
            config.remove("secret");
        }
    }

    private Map<String, String> mergeConfig(NotificationChannel existing, NotificationChannelRequest request) {
        Map<String, String> current = readConfig(existing.getConfigJson());
        Map<String, String> next = new LinkedHashMap<>();
        if (request.getConfig() != null) {
            next.putAll(request.getConfig());
        }
        if ("dingtalk".equals(request.getType()) && !StringUtils.hasText(next.get("secret")) && StringUtils.hasText(current.get("secret"))) {
            next.put("secret", current.get("secret"));
        }
        next.entrySet().removeIf(entry -> !StringUtils.hasText(entry.getValue()));
        return next;
    }

    private Map<String, String> readConfig(String json) {
        if (!StringUtils.hasText(json)) {
            return new LinkedHashMap<>();
        }
        try {
            Map<String, String> config = objectMapper.readValue(json, STRING_MAP);
            if (StringUtils.hasText(config.get("secret"))) {
                config.put("secret", secretCipher.decrypt(config.get("secret")));
            }
            return config;
        } catch (JsonProcessingException e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "通知渠道配置解析失败");
        }
    }

    private String writeConfig(Map<String, String> config) {
        try {
            Map<String, String> next = new LinkedHashMap<>(config == null ? Map.of() : config);
            if (StringUtils.hasText(next.get("secret"))) {
                next.put("secret", secretCipher.encrypt(next.get("secret")));
            }
            return objectMapper.writeValueAsString(next);
        } catch (JsonProcessingException e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "通知渠道配置序列化失败");
        }
    }

    private Map<String, String> maskSecret(Map<String, String> config) {
        if (!config.containsKey("secret")) {
            return config;
        }
        Map<String, String> masked = new LinkedHashMap<>(config);
        masked.put("secret", "******");
        return masked;
    }

    private boolean sendTestMessage(NotificationChannel channel) {
        if ("inapp".equals(channel.getType())) {
            return true;
        }

        Map<String, String> config = readConfig(channel.getConfigJson());
        String webhookUrl = config.get("webhook_url");
        if (!StringUtils.hasText(webhookUrl)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Webhook 地址不能为空");
        }

        try {
            String requestUrl = buildDingtalkUrl(channel.getType(), webhookUrl, config.get("secret"));
            String body = buildTestPayload(channel.getType());
            HttpRequest request = HttpRequest.newBuilder(URI.create(requestUrl))
                    .timeout(Duration.ofSeconds(5))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return true;
            }
            log.warn("Notification channel test failed: type={}, status={}, body={}", channel.getType(), response.statusCode(), response.body());
            return false;
        } catch (Exception e) {
            log.warn("Notification channel test failed: id={}, type={}", channel.getId(), channel.getType(), e);
            return false;
        }
    }

    /**
     * 发送特定渠道的告警消息
     */
    public void sendAlert(Long channelId, String title, String content) {
        if (channelId == null) {
            return;
        }
        NotificationChannel channel = getById(channelId);
        if (channel == null) {
            log.warn("Notification channel not found for id {}", channelId);
            return;
        }
        if (channel.getEnabled() == null || channel.getEnabled() == 0) {
            log.info("Notification channel id={} is disabled, skip alert", channelId);
            return;
        }
        try {
            sendNotification(channel, title, content);
        } catch (Exception e) {
            log.error("Failed to send alert to channel id={}, name={}: {}", channel.getId(), channel.getName(), e.getMessage());
        }
    }

    /**
     * 发送租户级别的告警消息到所有启用的告警渠道中
     */
    public void sendAlertForTenant(Long tenantId, String title, String content) {
        List<NotificationChannel> enabledChannels = lambdaQuery()
                .eq(NotificationChannel::getTenantId, tenantId)
                .eq(NotificationChannel::getEnabled, 1)
                .list();
        if (enabledChannels.isEmpty()) {
            log.info("No enabled notification channel found for tenant {}", tenantId);
            return;
        }
        for (NotificationChannel channel : enabledChannels) {
            try {
                sendNotification(channel, title, content);
            } catch (Exception e) {
                log.error("Failed to send alert to channel id={}, name={}: {}", channel.getId(), channel.getName(), e.getMessage());
            }
        }
    }

    private void sendNotification(NotificationChannel channel, String title, String content) throws Exception {
        if ("inapp".equals(channel.getType())) {
            log.info("[InApp Notification] {}: {}", title, content);
            return;
        }
        Map<String, String> config = readConfig(channel.getConfigJson());
        String webhookUrl = config.get("webhook_url");
        if (!StringUtils.hasText(webhookUrl)) {
            log.warn("Webhook URL is empty for channel id={}", channel.getId());
            return;
        }
        String requestUrl = buildDingtalkUrl(channel.getType(), webhookUrl, config.get("secret"));
        String body = buildPayload(channel.getType(), title, content);
        HttpRequest request = HttpRequest.newBuilder(URI.create(requestUrl))
                .timeout(Duration.ofSeconds(5))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new RuntimeException("HTTP Status Code: " + response.statusCode() + ", response: " + response.body());
        }
    }

    private String buildPayload(String type, String title, String content) throws JsonProcessingException {
        String formattedContent = title + "\n" + content;
        Map<String, Object> payload;
        switch (type) {
            case "feishu" -> payload = Map.of(
                    "msg_type", "text",
                    "content", Map.of("text", formattedContent)
            );
            case "wecom", "dingtalk" -> payload = Map.of(
                    "msgtype", "text",
                    "text", Map.of("content", formattedContent)
            );
            case "webhook" -> payload = Map.of(
                    "title", title,
                    "message", content
            );
            default -> throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "暂不支持当前渠道类型: " + type);
        }
        return objectMapper.writeValueAsString(payload);
    }

    private String buildTestPayload(String type) throws JsonProcessingException {
        String content = "[RayFlow] 告警渠道测试成功";
        Map<String, Object> payload;
        switch (type) {
            case "feishu" -> payload = Map.of(
                    "msg_type", "text",
                    "content", Map.of("text", content)
            );
            case "wecom", "dingtalk" -> payload = Map.of(
                    "msgtype", "text",
                    "text", Map.of("content", content)
            );
            case "webhook" -> payload = Map.of(
                    "title", "RayFlow Test",
                    "message", content
            );
            default -> throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "暂不支持当前渠道类型");
        }
        return objectMapper.writeValueAsString(payload);
    }

    private String buildDingtalkUrl(String type, String webhookUrl, String secret) {
        if (!"dingtalk".equals(type) || !StringUtils.hasText(secret)) {
            return webhookUrl;
        }
        try {
            long timestamp = System.currentTimeMillis();
            String stringToSign = timestamp + "\n" + secret;
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            String sign = URLEncoder.encode(Base64.getEncoder().encodeToString(mac.doFinal(stringToSign.getBytes(StandardCharsets.UTF_8))), StandardCharsets.UTF_8);
            String separator = webhookUrl.contains("?") ? "&" : "?";
            return webhookUrl + separator + "timestamp=" + timestamp + "&sign=" + sign;
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "钉钉签名生成失败");
        }
    }

    private static String normalizeKeyword(String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return null;
        }
        return keyword.trim();
    }
}
