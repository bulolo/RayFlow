package com.rayflow.server.service;

import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.model.entity.StarRocksConnection;
import com.rayflow.server.model.request.resource.StarRocksDdlRequest;
import com.rayflow.server.model.request.resource.StarRocksSqlQueryRequest;
import com.rayflow.server.model.response.resource.StarRocksDatabaseResponse;
import com.rayflow.server.model.response.resource.StarRocksObjectDefinitionResponse;
import com.rayflow.server.model.response.resource.StarRocksObjectResponse;
import com.rayflow.server.model.response.resource.StarRocksObjectSchemaResponse;
import com.rayflow.server.model.response.resource.StarRocksPreviewResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

@Slf4j
@Service
@RequiredArgsConstructor
public class StarRocksBrowserService {

    private static final int MAX_PREVIEW_LIMIT = 500;
    private static final int DEFAULT_QUERY_LIMIT = 1000;
    private static final int MAX_QUERY_LIMIT = 5000;

    private final StarRocksConnectionService connectionService;
    private final Map<String, CacheEntry<?>> cache = new ConcurrentHashMap<>();

    @Value("${rayflow.starrocks.browser.cache-ttl-ms:10800000}")
    private long cacheTtlMs;

    public List<StarRocksDatabaseResponse> listDatabases(Long connectionId, boolean refresh) {
        StarRocksConnection connection = connectionService.getRequired(connectionId);
        return cached("starrocks:" + connectionId + ":databases", refresh, () -> {
            List<StarRocksDatabaseResponse> databases = new ArrayList<>();
            executeQuery(connection, "SHOW DATABASES", resultSet -> {
                while (resultSet.next()) {
                    String database = resultSet.getString(1);
                    if (!isSystemDatabase(database)) {
                        databases.add(new StarRocksDatabaseResponse(database));
                    }
                }
            });
            return databases;
        });
    }

    public List<StarRocksObjectResponse> listObjects(Long connectionId, String databaseName, boolean refresh) {
        StarRocksConnection connection = connectionService.getRequired(connectionId);
        String database = requireIdentifier(databaseName, "Database");
        return cached("starrocks:" + connectionId + ":objects:" + database, refresh, () -> {
            Set<String> materializedViews = collectMaterializedViews(connection, database);
            List<StarRocksObjectResponse> objects = new ArrayList<>();
            executeQuery(connection, "SHOW FULL TABLES FROM " + quoteIdentifier(database), resultSet -> {
                while (resultSet.next()) {
                    String objectName = resultSet.getString(1);
                    String rawType = resultSet.getString(2);
                    String objectType = materializedViews.contains(objectName) ? "MATERIALIZED_VIEW" : normalizeObjectType(rawType);
                    objects.add(new StarRocksObjectResponse(database, objectName, objectType));
                }
            });
            return objects;
        });
    }

    public StarRocksObjectSchemaResponse getSchema(Long connectionId, String databaseName, String objectName, boolean refresh) {
        StarRocksConnection connection = connectionService.getRequired(connectionId);
        String database = requireIdentifier(databaseName, "Database");
        String object = requireIdentifier(objectName, "对象");
        return cached("starrocks:" + connectionId + ":schema:" + database + "." + object, refresh, () -> {
            List<StarRocksObjectSchemaResponse.Column> columns = new ArrayList<>();
            executeQuery(connection, "SHOW FULL COLUMNS FROM " + qualifiedName(database, object), resultSet -> {
                while (resultSet.next()) {
                    columns.add(new StarRocksObjectSchemaResponse.Column(
                            resultSet.getString("Field"),
                            resultSet.getString("Type"),
                            resultSet.getString("Null"),
                            resultSet.getString("Key"),
                            resultSet.getString("Default"),
                            resultSet.getString("Extra")
                    ));
                }
            });
            return StarRocksObjectSchemaResponse.builder()
                    .databaseName(database)
                    .objectName(object)
                    .columns(columns)
                    .build();
        });
    }

    public StarRocksObjectDefinitionResponse getDefinition(Long connectionId, String databaseName, String objectName, boolean refresh) {
        StarRocksConnection connection = connectionService.getRequired(connectionId);
        String database = requireIdentifier(databaseName, "Database");
        String object = requireIdentifier(objectName, "对象");
        return cached("starrocks:" + connectionId + ":definition:" + database + "." + object, refresh, () -> {
            List<StarRocksObjectResponse> objects = listObjects(connectionId, database, refresh);
            String objectType = objects.stream()
                    .filter(item -> object.equals(item.getObjectName()))
                    .map(StarRocksObjectResponse::getObjectType)
                    .findFirst()
                    .orElse("TABLE");
            String statement = "MATERIALIZED_VIEW".equals(objectType)
                    ? "SHOW CREATE MATERIALIZED VIEW " + qualifiedName(database, object)
                    : "SHOW CREATE TABLE " + qualifiedName(database, object);
            StringBuilder createSql = new StringBuilder();
            executeQuery(connection, statement, resultSet -> {
                if (resultSet.next()) {
                    ResultSetMetaData metaData = resultSet.getMetaData();
                    createSql.append(resultSet.getString(metaData.getColumnCount()));
                }
            });
            if (createSql.toString().trim().toUpperCase(Locale.ROOT).startsWith("CREATE MATERIALIZED VIEW")) {
                objectType = "MATERIALIZED_VIEW";
            }
            return StarRocksObjectDefinitionResponse.builder()
                    .databaseName(database)
                    .objectName(object)
                    .objectType(objectType)
                    .createSql(createSql.toString())
                    .build();
        });
    }

    public StarRocksPreviewResponse listPartitions(Long connectionId, String databaseName, String objectName, boolean refresh) {
        StarRocksConnection connection = connectionService.getRequired(connectionId);
        String database = requireIdentifier(databaseName, "Database");
        String object = requireIdentifier(objectName, "对象");
        return cached("starrocks:" + connectionId + ":partitions:" + database + "." + object, refresh, () -> {
            List<StarRocksPreviewResponse.Column> columns = new ArrayList<>();
            List<Map<String, Object>> rows = new ArrayList<>();
            executeQuery(connection, "SHOW PARTITIONS FROM " + qualifiedName(database, object), resultSet -> {
                ResultSetMetaData metaData = resultSet.getMetaData();
                for (int index = 1; index <= metaData.getColumnCount(); index++) {
                    columns.add(new StarRocksPreviewResponse.Column(metaData.getColumnLabel(index), metaData.getColumnTypeName(index)));
                }
                while (resultSet.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int index = 1; index <= metaData.getColumnCount(); index++) {
                        row.put(metaData.getColumnLabel(index), resultSet.getObject(index));
                    }
                    rows.add(row);
                }
            });
            return StarRocksPreviewResponse.builder()
                    .databaseName(database)
                    .objectName(object)
                    .columns(columns)
                    .data(rows)
                    .truncated(false)
                    .message("分区读取完成，返回 " + rows.size() + " 行")
                    .build();
        });
    }

    public StarRocksPreviewResponse preview(Long connectionId, String databaseName, String objectName, Integer limit) {
        StarRocksConnection connection = connectionService.getRequired(connectionId);
        String database = requireIdentifier(databaseName, "Database");
        String object = requireIdentifier(objectName, "对象");
        int targetLimit = Math.min(Math.max(limit == null ? 100 : limit, 1), MAX_PREVIEW_LIMIT);
        List<StarRocksPreviewResponse.Column> columns = new ArrayList<>();
        List<Map<String, Object>> rows = new ArrayList<>();
        String sql = "SELECT * FROM " + qualifiedName(database, object) + " LIMIT " + targetLimit;
        executeQuery(connection, sql, resultSet -> {
            ResultSetMetaData metaData = resultSet.getMetaData();
            for (int index = 1; index <= metaData.getColumnCount(); index++) {
                columns.add(new StarRocksPreviewResponse.Column(metaData.getColumnLabel(index), metaData.getColumnTypeName(index)));
            }
            while (resultSet.next()) {
                Map<String, Object> row = new LinkedHashMap<>();
                for (int index = 1; index <= metaData.getColumnCount(); index++) {
                    row.put(metaData.getColumnLabel(index), resultSet.getObject(index));
                }
                rows.add(row);
            }
        });
        return StarRocksPreviewResponse.builder()
                .databaseName(database)
                .objectName(object)
                .columns(columns)
                .data(rows)
                .truncated(rows.size() >= targetLimit)
                .build();
    }

    public void executeDdl(Long connectionId, StarRocksDdlRequest request) {
        StarRocksConnection connection = connectionService.getRequired(connectionId);
        String sql = normalizeDdl(request.getSql());
        try (Connection jdbcConnection = connectionService.openJdbcConnection(connection);
             Statement statement = jdbcConnection.createStatement()) {
            statement.execute(sql);
            evictConnectionCache(connectionId);
        } catch (Exception e) {
            log.warn("Failed to execute StarRocks DDL on connection {}", connectionId, e);
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "StarRocks DDL 执行失败：" + e.getMessage());
        }
    }

    public StarRocksPreviewResponse executeQuery(Long connectionId, StarRocksSqlQueryRequest request) {
        StarRocksConnection connection = connectionService.getRequired(connectionId);
        int targetLimit = Math.min(Math.max(request.getLimit() == null ? DEFAULT_QUERY_LIMIT : request.getLimit(), 1), MAX_QUERY_LIMIT);
        String sql = normalizeSqlCommand(request.getSql(), targetLimit);
        List<StarRocksPreviewResponse.Column> columns = new ArrayList<>();
        List<Map<String, Object>> rows = new ArrayList<>();
        String message;
        try (Connection jdbcConnection = connectionService.openJdbcConnection(connection);
             Statement statement = jdbcConnection.createStatement()) {
            statement.setMaxRows(targetLimit + 1);
            boolean hasResultSet = statement.execute(sql);
            if (!hasResultSet) {
                int updateCount = statement.getUpdateCount();
                evictConnectionCache(connectionId);
                return StarRocksPreviewResponse.builder()
                        .databaseName(connectionService.normalizeDatabase(connection))
                        .objectName("SQL")
                        .columns(List.of())
                        .data(List.of())
                        .truncated(false)
                        .message(updateCount >= 0 ? "SQL 执行完成，影响行数：" + updateCount : "SQL 执行完成")
                        .build();
            }
            try (ResultSet resultSet = statement.getResultSet()) {
                ResultSetMetaData metaData = resultSet.getMetaData();
                for (int index = 1; index <= metaData.getColumnCount(); index++) {
                    columns.add(new StarRocksPreviewResponse.Column(metaData.getColumnLabel(index), metaData.getColumnTypeName(index)));
                }
                while (resultSet.next() && rows.size() < targetLimit) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int index = 1; index <= metaData.getColumnCount(); index++) {
                        row.put(metaData.getColumnLabel(index), resultSet.getObject(index));
                    }
                    rows.add(row);
                }
            }
            message = "查询完成，返回 " + rows.size() + " 行";
        } catch (Exception e) {
            log.warn("Failed to execute StarRocks SQL command on connection {}", connectionId, e);
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "StarRocks SQL 命令执行失败：" + e.getMessage());
        }
        return StarRocksPreviewResponse.builder()
                .databaseName(connectionService.normalizeDatabase(connection))
                .objectName("SQL")
                .columns(columns)
                .data(rows)
                .truncated(rows.size() >= targetLimit)
                .message(message)
                .build();
    }

    private void executeQuery(StarRocksConnection connection, String sql, ResultSetConsumer consumer) {
        try (Connection jdbcConnection = connectionService.openJdbcConnection(connection);
             Statement statement = jdbcConnection.createStatement();
             ResultSet resultSet = statement.executeQuery(sql)) {
            consumer.accept(resultSet);
        } catch (Exception e) {
            log.warn("Failed to query StarRocks metadata: {}", sql, e);
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "StarRocks 浏览失败：" + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private <T> T cached(String key, boolean refresh, Supplier<T> supplier) {
        long now = System.currentTimeMillis();
        CacheEntry<?> current = cache.get(key);
        if (!refresh && current != null && current.expireAt > now) {
            return (T) current.value;
        }
        T value = supplier.get();
        cache.put(key, new CacheEntry<>(value, now + Math.max(cacheTtlMs, 1000)));
        return value;
    }

    private void evictConnectionCache(Long connectionId) {
        String prefix = "starrocks:" + connectionId + ":";
        cache.keySet().removeIf(key -> key.startsWith(prefix));
    }

    private String normalizeDdl(String rawSql) {
        String sql = rawSql == null ? "" : rawSql.trim();
        if (sql.isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "SQL 不能为空");
        }
        if (sql.endsWith(";")) {
            sql = sql.substring(0, sql.length() - 1).trim();
        }
        if (sql.contains(";")) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "只允许执行单条 DDL");
        }
        String normalized = sql.replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
        if (!normalized.startsWith("CREATE TABLE ") && !normalized.startsWith("CREATE MATERIALIZED VIEW ")) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "仅支持 CREATE TABLE 或 CREATE MATERIALIZED VIEW");
        }
        return sql;
    }

    private String normalizeSqlCommand(String rawSql, int limit) {
        String sql = rawSql == null ? "" : rawSql.trim();
        if (sql.isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "SQL 不能为空");
        }
        if (sql.endsWith(";")) {
            sql = sql.substring(0, sql.length() - 1).trim();
        }
        if (sql.contains(";")) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "只允许执行单条 SQL");
        }
        String normalized = sql.replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
        boolean selectLike = normalized.startsWith("SELECT ") || normalized.startsWith("WITH ");
        if (selectLike && !normalized.matches("(?s).*\\sLIMIT\\s+\\d+\\s*$")) {
            return sql + " LIMIT " + limit;
        }
        return sql;
    }

    private Set<String> collectMaterializedViews(StarRocksConnection connection, String database) {
        Set<String> materializedViews = new HashSet<>();
        try (Connection jdbcConnection = connectionService.openJdbcConnection(connection);
             Statement statement = jdbcConnection.createStatement();
             ResultSet resultSet = statement.executeQuery("SHOW MATERIALIZED VIEWS FROM " + quoteIdentifier(database))) {
            ResultSetMetaData metaData = resultSet.getMetaData();
            while (resultSet.next()) {
                String name = findColumnValue(resultSet, metaData, "name", "mv_name", "table_name", "Name");
                if (name != null && !name.isBlank()) {
                    materializedViews.add(name);
                }
            }
        } catch (Exception e) {
            log.debug("Skip StarRocks materialized view type enrichment for database {}: {}", database, e.getMessage());
        }
        return materializedViews;
    }

    private String findColumnValue(ResultSet resultSet, ResultSetMetaData metaData, String... candidates) throws Exception {
        for (String candidate : candidates) {
            for (int index = 1; index <= metaData.getColumnCount(); index++) {
                if (candidate.equalsIgnoreCase(metaData.getColumnLabel(index))) {
                    return resultSet.getString(index);
                }
            }
        }
        return metaData.getColumnCount() > 0 ? resultSet.getString(1) : null;
    }

    private String requireIdentifier(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), label + " 不能为空");
        }
        String trimmed = value.trim();
        if (trimmed.length() > 128 || trimmed.contains("\u0000")) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), label + " 不合法");
        }
        return trimmed;
    }

    private String qualifiedName(String databaseName, String objectName) {
        return quoteIdentifier(databaseName) + "." + quoteIdentifier(objectName);
    }

    private String quoteIdentifier(String identifier) {
        return "`" + identifier.replace("`", "``") + "`";
    }

    private String normalizeObjectType(String rawType) {
        if (rawType == null) {
            return "TABLE";
        }
        String normalized = rawType.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
        if (normalized.contains("MATERIALIZED") && normalized.contains("VIEW")) {
            return "MATERIALIZED_VIEW";
        }
        if (normalized.contains("VIEW")) {
            return "VIEW";
        }
        return "TABLE";
    }

    private boolean isSystemDatabase(String database) {
        if (database == null) {
            return true;
        }
        String normalized = database.toLowerCase(Locale.ROOT);
        return normalized.equals("information_schema")
                || normalized.equals("_statistics_")
                || normalized.equals("mysql")
                || normalized.equals("sys");
    }

    private record CacheEntry<T>(T value, long expireAt) {
    }

    @FunctionalInterface
    private interface ResultSetConsumer {
        void accept(ResultSet resultSet) throws Exception;
    }
}
