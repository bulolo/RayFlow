package com.rayflow.server.service;

import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.flink.client.FlinkRestClient;
import com.rayflow.flink.client.FlinkSqlGatewayClient;
import com.rayflow.flink.client.FlinkErrorParser;
import com.rayflow.server.model.request.flink.FlinkSqlPreviewRequest;
import com.rayflow.server.model.request.flink.FlinkSqlValidateRequest;
import com.rayflow.server.model.response.flink.FlinkSqlPreviewResponse;
import com.rayflow.server.model.response.flink.FlinkSqlValidateResponse;
import com.rayflow.server.model.entity.FlinkCluster;
import com.rayflow.server.service.submit.FlinkSqlStatementInspector;
import com.rayflow.server.service.submit.SqlRunnerJarResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class FlinkSqlPreviewService {

    private static final int DEFAULT_PREVIEW_LIMIT = 50;
    private static final int MAX_PREVIEW_LIMIT = 200;
    private static final String PREVIEW_CLUSTER_NAME = "内置";

    private final ConcurrentHashMap<String, String> uploadedJarCache = new ConcurrentHashMap<>();

    private final FlinkClusterService flinkClusterService;
    private final VariableService variableService;
    private final FlinkSqlPreviewResultStore previewResultStore;
    private final SqlRunnerJarResolver sqlRunnerJarResolver;

    @Value("${rayflow.flink.rest-connect-timeout-ms:3000}")
    private int connectTimeoutMs;

    @Value("${rayflow.flink.rest-read-timeout-ms:120000}")
    private int readTimeoutMs;

    @Value("${rayflow.preview.callback-base-url:}")
    private String previewCallbackBaseUrl;

    @Value("${rayflow.preview.callback-token:}")
    private String previewCallbackToken;

    @Value("${rayflow.preview.wait-timeout-ms:60000}")
    private long previewWaitTimeoutMs;

    @SuppressWarnings("unchecked")
    public FlinkSqlPreviewResponse executePreview(FlinkSqlPreviewRequest request) {
        flinkClusterService.getRequired(request.getClusterId());
        FlinkCluster cluster = resolvePreviewCluster();
        request.setSql(variableService.renderSqlForCurrentTenant(request.getSql()));

        FlinkSqlStatementInspector.SqlAnalysis analysis = FlinkSqlStatementInspector.analyze(request.getSql());
        if (analysis.statements().isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "SQL 内容不能为空");
        }

        int limit = normalizeLimit(request.getLimit());
        String lastStmt = analysis.statements().get(analysis.statements().size() - 1);
        if (analysis.hasInsert() || isRunnerPreviewQueryLike(lastStmt)) {
            return executeRunnerPreview(cluster, request, analysis, limit);
        }
        if (isGatewayPreviewQueryLike(lastStmt)) {
            return executeGatewayPreview(cluster, analysis, limit);
        }
        throw new BusinessException(
                ResultCode.BAD_REQUEST.getCode(),
                "查询预览当前仅支持 SELECT / WITH / VALUES / TABLE / SHOW / DESC / DESCRIBE / EXPLAIN，或单条 INSERT INTO ... SELECT ...。当前最后一条语句为: " + extractStatementType(lastStmt)
        );
    }

    public FlinkSqlValidateResponse validate(FlinkSqlValidateRequest request) {
        flinkClusterService.getRequired(request.getClusterId());
        try {
            String renderedSql = variableService.renderSqlForCurrentTenant(request.getSql());
            FlinkSqlStatementInspector.SqlAnalysis analysis = FlinkSqlStatementInspector.analyze(renderedSql);
            if (analysis.statements().isEmpty()) {
                return invalid("SQL 内容不能为空", 1, 1, 0);
            }
            return FlinkSqlValidateResponse.builder()
                    .valid(true)
                    .message("SQL 基础校验通过")
                    .line(null)
                    .column(null)
                    .statementCount(analysis.statements().size())
                    .build();
        } catch (BusinessException e) {
            return invalid(e.getMessage(), 1, 1, 0);
        } catch (Exception e) {
            return invalid("SQL 校验失败: " + e.getMessage(), 1, 1, 0);
        }
    }

    private FlinkSqlValidateResponse invalid(String message, int line, int column, int statementCount) {
        return FlinkSqlValidateResponse.builder()
                .valid(false)
                .message(message)
                .line(Math.max(line, 1))
                .column(Math.max(column, 1))
                .statementCount(statementCount)
                .build();
    }

    private FlinkCluster resolvePreviewCluster() {
        try {
            return flinkClusterService.getRequiredGlobalByName(PREVIEW_CLUSTER_NAME);
        } catch (BusinessException e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "未找到查询预览专用运行时: " + PREVIEW_CLUSTER_NAME);
        }
    }

    private FlinkSqlPreviewResponse executeRunnerPreview(
            FlinkCluster cluster,
            FlinkSqlPreviewRequest request,
            FlinkSqlStatementInspector.SqlAnalysis analysis,
            int targetLimit
    ) {
        String lastStmt = analysis.statements().get(analysis.statements().size() - 1);
        if (analysis.hasInsert() && !analysis.singleInsert()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "查询预览当前仅支持单条 INSERT INTO ... SELECT ...");
        }
        if (!analysis.hasInsert() && !isRunnerPreviewQueryLike(lastStmt)) {
            throw new BusinessException(
                    ResultCode.BAD_REQUEST.getCode(),
                    "查询预览当前仅支持 SELECT / WITH / VALUES / TABLE，或单条 INSERT INTO ... SELECT ..."
            );
        }

        FlinkRestClient restClient = new FlinkRestClient(cluster.getAddress(), connectTimeoutMs, readTimeoutMs);
        if (!restClient.isHealthy()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Flink 运行时连接失败，请检查运行时地址或状态: " + cluster.getAddress());
        }

        String previewId = previewResultStore.createPendingSession();
        String jobId = null;
        try {
            File runnerJar = sqlRunnerJarResolver.resolve();
            String clusterKey = cluster.getAddress();
            String jarId = uploadedJarCache.get(clusterKey);
            boolean firstTrySuccess = false;

            if (jarId != null) {
                try {
                    jobId = runJarWithArgs(restClient, jarId, request, previewId, targetLimit);
                    firstTrySuccess = true;
                } catch (Exception e) {
                    log.warn("Failed to run cached jar {} on cluster {}, invalidating cache and retrying. Error: {}", 
                            jarId, clusterKey, e.getMessage());
                    uploadedJarCache.remove(clusterKey);
                }
            }

            if (!firstTrySuccess) {
                jarId = restClient.uploadJar(runnerJar);
                uploadedJarCache.put(clusterKey, jarId);
                jobId = runJarWithArgs(restClient, jarId, request, previewId, targetLimit);
            }

            return waitPreviewResult(previewId, jobId, restClient);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "查询预览提交失败: " + FlinkErrorParser.parse(e), e);
        }
    }

    private String runJarWithArgs(
            FlinkRestClient restClient,
            String jarId,
            FlinkSqlPreviewRequest request,
            String previewId,
            int targetLimit
    ) {
        String sqlBase64 = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(request.getSql().getBytes(StandardCharsets.UTF_8));
        String jobNameBase64 = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(normalizePreviewJobName(request.getJobName()).getBytes(StandardCharsets.UTF_8));

        String programArgs = "--sql-base64 " + sqlBase64
                + " --job-name-base64 " + jobNameBase64
                + " --parallelism " + 1
                + " --preview true"
                + " --preview-id " + previewId
                + " --preview-limit " + targetLimit
                + " --preview-callback-url " + buildCallbackUrl(previewId)
                + " --preview-callback-token " + previewCallbackToken;

        return restClient.runJar(
                jarId,
                "com.rayflow.flink.sqlrunner.RayFlowSqlRunner",
                programArgs,
                1,
                null
        );
    }

    @SuppressWarnings("unchecked")
    private FlinkSqlPreviewResponse executeGatewayPreview(
            FlinkCluster cluster,
            FlinkSqlStatementInspector.SqlAnalysis analysis,
            int targetLimit
    ) {
        if (cluster.getGatewayAddress() == null || cluster.getGatewayAddress().isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "该运行时未配置 SQL Gateway，当前语句无法进行查询预览");
        }

        FlinkSqlGatewayClient client = new FlinkSqlGatewayClient(cluster.getGatewayAddress(), connectTimeoutMs, readTimeoutMs);
        if (!client.isHealthy()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Flink SQL Gateway 连接失败，请检查网关地址或状态: " + cluster.getGatewayAddress());
        }

        String sessionHandle = client.openSession("rayflow-preview-session-" + System.currentTimeMillis());
        String previewOpHandle = null;
        try {
            List<String> statements = analysis.statements();
            for (int i = 0; i < statements.size(); i++) {
                String statement = statements.get(i);
                previewOpHandle = client.executeStatement(sessionHandle, statement);
                waitGatewayOperationFinished(client, sessionHandle, previewOpHandle, previewWaitTimeoutMs);
                if (i < statements.size() - 1) {
                    previewOpHandle = null;
                }
            }

            if (previewOpHandle == null) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "查询预览未找到可执行的结果语句");
            }
            return collectGatewayPreviewResult(client, sessionHandle, previewOpHandle, targetLimit);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "查询预览提交失败: " + e.getMessage());
        } finally {
            if (previewOpHandle != null) {
                client.cancelOperation(sessionHandle, previewOpHandle);
            }
            client.closeSession(sessionHandle);
        }
    }

    private FlinkSqlPreviewResponse waitPreviewResult(String previewId, String jobId, FlinkRestClient restClient) {
        long deadline = System.currentTimeMillis() + previewWaitTimeoutMs;
        while (System.currentTimeMillis() < deadline) {
            FlinkSqlPreviewResultStore.PreviewSession session = previewResultStore.get(previewId);
            if (session != null) {
                if (session.getStatus() == FlinkSqlPreviewResultStore.Status.SUCCESS) {
                    FlinkSqlPreviewResponse response = new FlinkSqlPreviewResponse();
                    response.setPreviewType(session.getPreviewType() == null ? "TABLE" : session.getPreviewType());
                    response.setColumns(session.getColumns());
                    response.setData(session.getData());
                    response.setTruncated(session.isTruncated());
                    response.setMessage("SINK_TABLE".equals(session.getPreviewType()) ? "INSERT 预览结果，不会写入真实目标" : "查询预览结果");
                    return response;
                }
                if (session.getStatus() == FlinkSqlPreviewResultStore.Status.FAILED) {
                    throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), session.getErrorMessage());
                }
            }
            sleepQuietly(500);
        }
        if (jobId != null && !jobId.isBlank()) {
            try {
                restClient.cancelJob(jobId);
            } catch (Exception e) {
                log.warn("Failed to cancel timed-out preview job {}: {}", jobId, e.getMessage());
            }
        }
        throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "等待查询预览结果超时");
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return DEFAULT_PREVIEW_LIMIT;
        }
        return Math.min(limit, MAX_PREVIEW_LIMIT);
    }

    private boolean isRunnerPreviewQueryLike(String statement) {
        String type = extractStatementType(statement);
        return "SELECT".equals(type)
                || "WITH".equals(type)
                || "VALUES".equals(type)
                || "TABLE".equals(type);
    }

    private boolean isGatewayPreviewQueryLike(String statement) {
        String type = extractStatementType(statement);
        return "SHOW".equals(type)
                || "DESC".equals(type)
                || "DESCRIBE".equals(type)
                || "EXPLAIN".equals(type);
    }

    private String extractStatementType(String statement) {
        String normalized = statement == null ? "" : statement.trim();
        if (normalized.isEmpty()) {
            return "EMPTY";
        }
        int end = normalized.length();
        for (int i = 0; i < normalized.length(); i++) {
            if (Character.isWhitespace(normalized.charAt(i))) {
                end = i;
                break;
            }
        }
        return normalized.substring(0, Math.max(end, 1)).toUpperCase();
    }

    private String buildCallbackUrl(String previewId) {
        String base = previewCallbackBaseUrl;
        if (base == null || base.isBlank()) {
            base = "http://backend:3000";
        }
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + "/internal/flink/sql-preview-results/" + previewId;
    }

    private String normalizePreviewJobName(String jobName) {
        String normalized = jobName == null || jobName.isBlank() ? "rayflow-insert-preview" : jobName.trim();
        return normalized + "-preview";
    }

    private void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void waitGatewayOperationFinished(
            FlinkSqlGatewayClient client,
            String sessionHandle,
            String operationHandle,
            long timeoutMs
    ) {
        long deadline = System.currentTimeMillis() + timeoutMs;
        String status = "PENDING";
        while (System.currentTimeMillis() < deadline) {
            status = client.getOperationStatus(sessionHandle, operationHandle);
            if ("FINISHED".equalsIgnoreCase(status)) {
                return;
            }
            if ("ERROR".equalsIgnoreCase(status) || "CANCELED".equalsIgnoreCase(status) || "TIMEOUT".equalsIgnoreCase(status) || "CLOSED".equalsIgnoreCase(status)) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "查询预览执行失败，当前状态为: " + status);
            }
            sleepQuietly(500);
        }
        throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "等待查询预览结果超时，当前状态为: " + status);
    }

    @SuppressWarnings("unchecked")
    private FlinkSqlPreviewResponse collectGatewayPreviewResult(
            FlinkSqlGatewayClient client,
            String sessionHandle,
            String operationHandle,
            int targetLimit
    ) {
        List<FlinkSqlPreviewResponse.ColumnInfo> columns = new ArrayList<>();
        List<Map<String, Object>> rows = new ArrayList<>();
        boolean truncated = false;
        String token = "0";

        while (token != null && !token.isBlank()) {
            Map<String, Object> page = client.getExecutionResult(sessionHandle, operationHandle, token);
            if (columns.isEmpty()) {
                columns.addAll(parseGatewayColumns(page));
            }

            Map<String, Object> results = page == null ? null : (Map<String, Object>) page.get("results");
            List<?> data = results == null ? null : (List<?>) results.get("data");
            if (data != null) {
                for (Object item : data) {
                    if (rows.size() >= targetLimit) {
                        truncated = true;
                        break;
                    }
                    rows.add(parseGatewayRow(item, columns));
                }
            }
            if (truncated) {
                break;
            }

            token = extractNextResultToken(page);
            if (token == null || token.isBlank() || "0".equals(token)) {
                break;
            }
        }

        FlinkSqlPreviewResponse response = new FlinkSqlPreviewResponse();
        response.setPreviewType("TABLE");
        response.setColumns(columns);
        response.setData(rows);
        response.setTruncated(truncated);
        response.setMessage("查询预览结果");
        return response;
    }

    @SuppressWarnings("unchecked")
    private List<FlinkSqlPreviewResponse.ColumnInfo> parseGatewayColumns(Map<String, Object> page) {
        List<FlinkSqlPreviewResponse.ColumnInfo> columns = new ArrayList<>();
        if (page == null) {
            return columns;
        }

        Object resultSchemaObj = page.get("resultSchema");
        if (resultSchemaObj instanceof Map<?, ?> resultSchema) {
            Object columnsObj = resultSchema.get("columns");
            if (columnsObj instanceof List<?> resultColumns) {
                for (Object item : resultColumns) {
                    if (item instanceof Map<?, ?> column) {
                        String name = stringValue(column.get("name"));
                        String type = stringValue(column.get("logicalType"));
                        if (type == null || type.isBlank()) {
                            type = stringValue(column.get("type"));
                        }
                        columns.add(new FlinkSqlPreviewResponse.ColumnInfo(name, type == null ? "STRING" : type));
                    }
                }
            }
        }

        if (!columns.isEmpty()) {
            return columns;
        }

        Map<String, Object> results = (Map<String, Object>) page.get("results");
        Object resultColumnsObj = results == null ? null : results.get("columns");
        if (resultColumnsObj instanceof List<?> resultColumns) {
            for (Object item : resultColumns) {
                if (item instanceof Map<?, ?> column) {
                    String name = stringValue(column.get("name"));
                    String type = extractGatewayColumnType(column.get("logicalType"));
                    if (type == null || type.isBlank()) {
                        type = stringValue(column.get("type"));
                    }
                    columns.add(new FlinkSqlPreviewResponse.ColumnInfo(name, type == null ? "STRING" : type));
                }
            }
        }

        if (!columns.isEmpty()) {
            return columns;
        }

        Object dataObj = results == null ? null : results.get("data");
        if (dataObj instanceof List<?> data && !data.isEmpty()) {
            Object first = data.get(0);
            if (first instanceof Map<?, ?> rowMap) {
                Object fieldsObj = rowMap.get("fields");
                if (fieldsObj instanceof List<?> fields) {
                    for (int i = 0; i < fields.size(); i++) {
                        columns.add(new FlinkSqlPreviewResponse.ColumnInfo("column_" + (i + 1), "STRING"));
                    }
                }
            }
        }
        return columns;
    }

    private String extractGatewayColumnType(Object logicalType) {
        if (logicalType == null) {
            return null;
        }
        if (logicalType instanceof Map<?, ?> logicalTypeMap) {
            Object type = logicalTypeMap.get("type");
            return type == null ? logicalTypeMap.toString() : String.valueOf(type);
        }
        return String.valueOf(logicalType);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseGatewayRow(Object item, List<FlinkSqlPreviewResponse.ColumnInfo> columns) {
        List<?> fields = null;
        if (item instanceof Map<?, ?> rowMap) {
            Object fieldsObj = rowMap.get("fields");
            if (fieldsObj instanceof List<?> fieldList) {
                fields = fieldList;
            }
        } else if (item instanceof List<?> fieldList) {
            fields = fieldList;
        }

        Map<String, Object> row = new LinkedHashMap<>();
        if (fields == null) {
            row.put("value", item);
            return row;
        }

        for (int i = 0; i < fields.size(); i++) {
            String name = i < columns.size() && columns.get(i).getName() != null && !columns.get(i).getName().isBlank()
                    ? columns.get(i).getName()
                    : "column_" + (i + 1);
            row.put(name, normalizeGatewayValue(fields.get(i)));
        }
        return row;
    }

    private Object normalizeGatewayValue(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number || value instanceof Boolean || value instanceof CharSequence) {
            return value;
        }
        return String.valueOf(value);
    }

    private String extractNextResultToken(Map<String, Object> page) {
        if (page == null) {
            return null;
        }
        Object nextToken = page.get("nextResultUri");
        if (nextToken instanceof String uri && !uri.isBlank()) {
            int slash = uri.lastIndexOf('/');
            return slash >= 0 ? uri.substring(slash + 1) : uri;
        }
        Object token = page.get("nextToken");
        if (token != null) {
            return String.valueOf(token);
        }
        return null;
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
