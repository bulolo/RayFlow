package com.rayflow.server.service;

import com.rayflow.server.model.response.flink.FlinkSqlPreviewResponse;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class FlinkSqlPreviewResultStore {

    private static final long SESSION_TTL_MS = Duration.ofMinutes(10).toMillis();

    private final ConcurrentHashMap<String, PreviewSession> sessions = new ConcurrentHashMap<>();

    public String createPendingSession() {
        cleanupExpiredSessions();
        String previewId = UUID.randomUUID().toString();
        sessions.put(previewId, PreviewSession.pending(previewId, System.currentTimeMillis() + SESSION_TTL_MS));
        return previewId;
    }

    public void complete(
            String previewId,
            String previewType,
            List<FlinkSqlPreviewResponse.ColumnInfo> columns,
            List<Map<String, Object>> data,
            boolean truncated
    ) {
        sessions.computeIfPresent(previewId, (key, session) -> session.complete(
                previewType,
                columns == null ? List.of() : List.copyOf(columns),
                data == null ? List.of() : List.copyOf(data),
                truncated,
                System.currentTimeMillis() + SESSION_TTL_MS
        ));
    }

    public void fail(String previewId, String errorMessage) {
        sessions.computeIfPresent(previewId, (key, session) -> session.fail(
                errorMessage == null || errorMessage.isBlank() ? "预览任务执行失败" : errorMessage,
                System.currentTimeMillis() + SESSION_TTL_MS
        ));
    }

    public PreviewSession get(String previewId) {
        cleanupExpiredSessions();
        return sessions.get(previewId);
    }

    public static final class PreviewSession {
        private final String previewId;
        private final Status status;
        private final String previewType;
        private final List<FlinkSqlPreviewResponse.ColumnInfo> columns;
        private final List<Map<String, Object>> data;
        private final boolean truncated;
        private final String errorMessage;
        private final long expireAt;

        private PreviewSession(
                String previewId,
                Status status,
                String previewType,
                List<FlinkSqlPreviewResponse.ColumnInfo> columns,
                List<Map<String, Object>> data,
                boolean truncated,
                String errorMessage,
                long expireAt
        ) {
            this.previewId = previewId;
            this.status = status;
            this.previewType = previewType;
            this.columns = columns;
            this.data = data;
            this.truncated = truncated;
            this.errorMessage = errorMessage;
            this.expireAt = expireAt;
        }

        public static PreviewSession pending(String previewId, long expireAt) {
            return new PreviewSession(previewId, Status.PENDING, null, List.of(), List.of(), false, null, expireAt);
        }

        public PreviewSession complete(
                String previewType,
                List<FlinkSqlPreviewResponse.ColumnInfo> columns,
                List<Map<String, Object>> data,
                boolean truncated,
                long expireAt
        ) {
            return new PreviewSession(previewId, Status.SUCCESS, previewType, new ArrayList<>(columns), new ArrayList<>(data), truncated, null, expireAt);
        }

        public PreviewSession fail(String errorMessage, long expireAt) {
            return new PreviewSession(previewId, Status.FAILED, null, List.of(), List.of(), false, errorMessage, expireAt);
        }

        public String getPreviewId() {
            return previewId;
        }

        public Status getStatus() {
            return status;
        }

        public List<FlinkSqlPreviewResponse.ColumnInfo> getColumns() {
            return columns;
        }

        public String getPreviewType() {
            return previewType;
        }

        public List<Map<String, Object>> getData() {
            return data;
        }

        public boolean isTruncated() {
            return truncated;
        }

        public String getErrorMessage() {
            return errorMessage;
        }

        public long getExpireAt() {
            return expireAt;
        }
    }

    public enum Status {
        PENDING,
        SUCCESS,
        FAILED
    }

    private void cleanupExpiredSessions() {
        long now = System.currentTimeMillis();
        sessions.entrySet().removeIf(entry -> entry.getValue().getExpireAt() <= now);
    }
}
