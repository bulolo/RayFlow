package com.rayflow.flink.sqlrunner;

import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.table.api.EnvironmentSettings;
import org.apache.flink.table.api.StatementSet;
import org.apache.flink.table.api.Table;
import org.apache.flink.table.api.TableResult;
import org.apache.flink.table.api.bridge.java.StreamTableEnvironment;
import org.apache.flink.table.catalog.ResolvedSchema;
import org.apache.flink.util.CloseableIterator;
import org.apache.flink.types.Row;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class RayFlowSqlRunner {

    public static void main(String[] args) {
        Map<String, String> parameters = parseArgs(args);
        String encodedSql = parameters.get("sql-base64");
        if (encodedSql == null || encodedSql.isBlank()) {
            throw new IllegalArgumentException("--sql-base64 is required");
        }

        String sql = new String(Base64.getUrlDecoder().decode(encodedSql), StandardCharsets.UTF_8);
        String encodedJobName = parameters.get("job-name-base64");
        String jobName = encodedJobName == null || encodedJobName.isBlank()
                ? null
                : new String(Base64.getUrlDecoder().decode(encodedJobName), StandardCharsets.UTF_8);

        if (Boolean.parseBoolean(parameters.getOrDefault("preview", "false"))) {
            executePreview(sql, jobName, parameters);
            return;
        }

        StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
        int parallelism = parseInt(parameters.get("parallelism"), 1);
        if (parallelism > 0) {
            env.setParallelism(parallelism);
        }

        String upperSql = sql.toUpperCase(Locale.ROOT);
        boolean isBatch = upperSql.contains("EXECUTION.RUNTIME-MODE") && upperSql.contains("BATCH");
        EnvironmentSettings settings = isBatch
                ? EnvironmentSettings.newInstance().inBatchMode().build()
                : EnvironmentSettings.newInstance().inStreamingMode().build();
        StreamTableEnvironment tableEnv = StreamTableEnvironment.create(env, settings);
        if (jobName != null && !jobName.isBlank()) {
            tableEnv.getConfig().getConfiguration().setString("pipeline.name", jobName);
        }
        StatementSet statementSet = tableEnv.createStatementSet();

        boolean hasInsert = false;
        for (String statement : splitStatements(sql)) {
            String normalized = statement.trim();
            if (normalized.isEmpty()) {
                continue;
            }
            String upper = normalized.toUpperCase(Locale.ROOT);
            if (upper.startsWith("SET ")) {
                applySet(tableEnv, normalized);
            } else if (upper.startsWith("INSERT ")) {
                statementSet.addInsertSql(normalized);
                hasInsert = true;
            } else {
                tableEnv.executeSql(normalized);
            }
        }

        if (!hasInsert) {
            throw new IllegalArgumentException("Flink SQL must contain at least one INSERT statement");
        }
        statementSet.execute();
    }

    private static void executePreview(String sql, String jobName, Map<String, String> parameters) {
        String callbackUrl = required(parameters, "preview-callback-url");
        String callbackToken = parameters.getOrDefault("preview-callback-token", "");
        int previewLimit = Math.max(parseInt(parameters.get("preview-limit"), 50), 1);
        PreviewResultCallbackClient callbackClient = new PreviewResultCallbackClient();
        try {
            StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
            env.setParallelism(1);

            String upperSql = sql.toUpperCase(Locale.ROOT);
            boolean isBatch = upperSql.contains("EXECUTION.RUNTIME-MODE") && upperSql.contains("BATCH");
            EnvironmentSettings settings = isBatch
                    ? EnvironmentSettings.newInstance().inBatchMode().build()
                    : EnvironmentSettings.newInstance().inStreamingMode().build();
            StreamTableEnvironment tableEnv = StreamTableEnvironment.create(env, settings);
            if (jobName != null && !jobName.isBlank()) {
                tableEnv.getConfig().getConfiguration().setString("pipeline.name", jobName);
            }

            List<String> statements = splitStatements(sql);
            if (statements.isEmpty()) {
                throw new IllegalArgumentException("Preview SQL is empty");
            }

            String insertStatement = null;
            String queryStatement = null;
            for (int index = 0; index < statements.size(); index++) {
                String statement = statements.get(index);
                String normalized = statement.trim();
                if (normalized.isEmpty()) {
                    continue;
                }
                String upper = normalized.toUpperCase(Locale.ROOT);
                if (upper.startsWith("SET ")) {
                    applySet(tableEnv, normalized);
                } else if (upper.startsWith("INSERT ")) {
                    if (insertStatement != null) {
                        throw new IllegalArgumentException("Preview mode only supports a single INSERT statement");
                    }
                    insertStatement = normalized;
                } else if (isPreviewQueryLike(normalized) || isResultQueryLike(normalized)) {
                    if (index != statements.size() - 1) {
                        throw new IllegalArgumentException("Preview query statement must be the last SQL statement");
                    }
                    if (queryStatement != null) {
                        throw new IllegalArgumentException("Preview mode only supports a single query statement");
                    }
                    queryStatement = normalized;
                } else {
                    tableEnv.executeSql(normalized);
                }
            }

            if (insertStatement != null && queryStatement != null) {
                throw new IllegalArgumentException("Preview mode does not support mixing query preview and INSERT preview in one request");
            }

            String querySql;
            String previewType;
            if (insertStatement != null) {
                querySql = extractQuerySql(insertStatement);
                previewType = "SINK_TABLE";
            } else if (queryStatement != null) {
                querySql = queryStatement;
                previewType = "TABLE";
            } else {
                throw new IllegalArgumentException("Preview mode requires a query statement or one INSERT INTO ... SELECT ... statement");
            }

            if (isResultQueryLike(querySql)) {
                collectTableResult(tableEnv, querySql, previewLimit, previewType, callbackUrl, callbackToken);
                return;
            }

            Table queryTable = tableEnv.sqlQuery(querySql).fetch(previewLimit + 1);
            ResolvedSchema schema = queryTable.getResolvedSchema();
            List<PreviewResultColumn> columns = new ArrayList<>();
            List<String> columnNames = schema.getColumnNames();
            List<?> columnTypes = schema.getColumnDataTypes();
            for (int i = 0; i < columnNames.size(); i++) {
                columns.add(new PreviewResultColumn(columnNames.get(i), String.valueOf(columnTypes.get(i))));
            }

            DataStream<Row> previewStream = tableEnv.toDataStream(queryTable);
            previewStream
                    .addSink(new PreviewCollectSink(callbackUrl, callbackToken, previewLimit, previewType, columns))
                    .name("rayflow-preview-sink")
                    .setParallelism(1);

            env.execute(jobName == null || jobName.isBlank() ? "rayflow-sql-preview" : jobName);
        } catch (Exception e) {
            try {
                callbackClient.reportFailure(callbackUrl, callbackToken, e.getMessage());
            } catch (Exception ignored) {
                // ignore callback failure after original preview exception
            }
            throw new RuntimeException("Failed to execute preview SQL: " + e.getMessage(), e);
        }
    }

    private static void collectTableResult(
            StreamTableEnvironment tableEnv,
            String querySql,
            int previewLimit,
            String previewType,
            String callbackUrl,
            String callbackToken
    ) throws Exception {
        TableResult tableResult = tableEnv.executeSql(querySql);
        ResolvedSchema schema = tableResult.getResolvedSchema();
        List<PreviewResultColumn> columns = new ArrayList<>();
        List<String> columnNames = schema.getColumnNames();
        List<?> columnTypes = schema.getColumnDataTypes();
        for (int i = 0; i < columnNames.size(); i++) {
            columns.add(new PreviewResultColumn(columnNames.get(i), String.valueOf(columnTypes.get(i))));
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        boolean truncated = false;
        try (CloseableIterator<Row> iterator = tableResult.collect()) {
            while (iterator.hasNext()) {
                Row row = iterator.next();
                if (rows.size() >= previewLimit) {
                    truncated = true;
                    break;
                }
                rows.add(toRecord(row, columns));
            }
        }

        new PreviewResultCallbackClient().reportSuccess(callbackUrl, callbackToken, rows, columns, truncated, previewType);
    }

    private static String extractQuerySql(String insertStatement) {
        int queryStart = findQueryStart(insertStatement);
        if (queryStart < 0) {
            throw new IllegalArgumentException("INSERT preview currently requires INSERT INTO ... SELECT ...");
        }
        return insertStatement.substring(queryStart).trim();
    }

    private static int findQueryStart(String statement) {
        boolean inSingleQuote = false;
        boolean inDoubleQuote = false;
        for (int i = 0; i < statement.length(); i++) {
            char c = statement.charAt(i);
            if (c == '\'' && !inDoubleQuote && !isEscaped(statement, i)) {
                inSingleQuote = !inSingleQuote;
            } else if (c == '"' && !inSingleQuote && !isEscaped(statement, i)) {
                inDoubleQuote = !inDoubleQuote;
            }
            if (inSingleQuote || inDoubleQuote) {
                continue;
            }
            if (matchesKeyword(statement, i, "SELECT") || matchesKeyword(statement, i, "WITH")) {
                return i;
            }
        }
        return -1;
    }

    private static boolean matchesKeyword(String statement, int index, String keyword) {
        if (index + keyword.length() > statement.length()) {
            return false;
        }
        String slice = statement.substring(index, index + keyword.length());
        if (!slice.equalsIgnoreCase(keyword)) {
            return false;
        }
        boolean leftBoundary = index == 0 || !Character.isLetterOrDigit(statement.charAt(index - 1));
        int end = index + keyword.length();
        boolean rightBoundary = end >= statement.length() || !Character.isLetterOrDigit(statement.charAt(end));
        return leftBoundary && rightBoundary;
    }

    private static boolean isPreviewQueryLike(String statement) {
        String type = extractStatementType(statement);
        return "SELECT".equals(type)
                || "WITH".equals(type)
                || "VALUES".equals(type)
                || "TABLE".equals(type);
    }

    private static boolean isResultQueryLike(String statement) {
        String type = extractStatementType(statement);
        return "SHOW".equals(type)
                || "DESC".equals(type)
                || "DESCRIBE".equals(type)
                || "EXPLAIN".equals(type);
    }

    private static String extractStatementType(String statement) {
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
        return normalized.substring(0, Math.max(end, 1)).toUpperCase(Locale.ROOT);
    }

    private static String required(Map<String, String> parameters, String key) {
        String value = parameters.get(key);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("--" + key + " is required");
        }
        return value;
    }

    private static Map<String, String> parseArgs(String[] args) {
        Map<String, String> parameters = new HashMap<>();
        for (int i = 0; i < args.length; i++) {
            String arg = args[i];
            if (!arg.startsWith("--")) {
                continue;
            }
            String key = arg.substring(2);
            String value = "true";
            if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
                value = args[++i];
            }
            parameters.put(key, value);
        }
        return parameters;
    }

    private static int parseInt(String value, int defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return Integer.parseInt(value);
    }

    private static void applySet(StreamTableEnvironment tableEnv, String statement) {
        String expression = statement.substring(3).trim();
        int eqIndex = expression.indexOf('=');
        if (eqIndex < 0) {
            throw new IllegalArgumentException("Invalid SET statement: " + statement);
        }
        String key = stripQuotes(expression.substring(0, eqIndex).trim());
        String value = stripQuotes(expression.substring(eqIndex + 1).trim());
        tableEnv.getConfig().getConfiguration().setString(key, value);
    }

    private static String stripQuotes(String value) {
        String result = value;
        if (result.endsWith(";")) {
            result = result.substring(0, result.length() - 1).trim();
        }
        if ((result.startsWith("'") && result.endsWith("'")) || (result.startsWith("\"") && result.endsWith("\""))) {
            return result.substring(1, result.length() - 1);
        }
        return result;
    }

    private static Map<String, Object> toRecord(Row row, List<PreviewResultColumn> columns) {
        Map<String, Object> record = new LinkedHashMap<>();
        for (int i = 0; i < columns.size(); i++) {
            Object field = i < row.getArity() ? row.getField(i) : null;
            record.put(columns.get(i).getName(), normalizeValue(field));
        }
        return record;
    }

    private static Object normalizeValue(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number || value instanceof Boolean || value instanceof CharSequence) {
            return value;
        }
        return value.toString();
    }

    private static List<String> splitStatements(String sql) {
        List<String> statements = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean singleQuoted = false;
        boolean doubleQuoted = false;
        boolean lineComment = false;

        for (int i = 0; i < sql.length(); i++) {
            char ch = sql.charAt(i);
            char next = i + 1 < sql.length() ? sql.charAt(i + 1) : '\0';

            if (lineComment) {
                current.append(ch);
                if (ch == '\n') {
                    lineComment = false;
                }
                continue;
            }
            if (!singleQuoted && !doubleQuoted && ch == '-' && next == '-') {
                lineComment = true;
                current.append(ch);
                continue;
            }
            if (!doubleQuoted && ch == '\'' && !isEscaped(sql, i)) {
                singleQuoted = !singleQuoted;
            } else if (!singleQuoted && ch == '"' && !isEscaped(sql, i)) {
                doubleQuoted = !doubleQuoted;
            }

            if (!singleQuoted && !doubleQuoted && ch == ';') {
                statements.add(current.toString());
                current.setLength(0);
            } else {
                current.append(ch);
            }
        }

        if (!current.toString().trim().isEmpty()) {
            statements.add(current.toString());
        }
        return statements;
    }

    private static boolean isEscaped(String value, int index) {
        int slashCount = 0;
        for (int i = index - 1; i >= 0 && value.charAt(i) == '\\'; i--) {
            slashCount++;
        }
        return slashCount % 2 == 1;
    }
}
