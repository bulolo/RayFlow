package com.rayflow.server.service.submit;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class FlinkSqlStatementInspector {

    private FlinkSqlStatementInspector() {
    }

    public static SqlAnalysis analyze(String sql) {
        List<String> statements = new ArrayList<>();
        for (String statement : splitStatements(sql)) {
            String cleaned = cleanStatement(statement);
            if (!cleaned.isEmpty()) {
                statements.add(cleaned);
            }
        }

        boolean hasInsert = false;
        boolean hasSelect = false;
        boolean hasWith = false;
        int insertCount = 0;
        for (String statement : statements) {
            String upper = statement.toUpperCase(Locale.ROOT);
            if (upper.startsWith("INSERT ")) {
                hasInsert = true;
                insertCount++;
            } else if (upper.startsWith("WITH ")) {
                hasWith = true;
                hasSelect = true;
            } else if (upper.startsWith("SELECT ")) {
                hasSelect = true;
            }
        }

        boolean selectOnly = !hasInsert && hasSelect;
        boolean singleInsert = insertCount == 1;
        return new SqlAnalysis(statements, hasInsert, hasSelect, hasWith, selectOnly, singleInsert, insertCount);
    }

    public static List<String> splitStatements(String sql) {
        List<String> statements = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean inSingleQuote = false;
        boolean inDoubleQuote = false;
        for (int i = 0; i < sql.length(); i++) {
            char c = sql.charAt(i);
            if (c == '\'' && !inDoubleQuote) {
                inSingleQuote = !inSingleQuote;
            } else if (c == '"' && !inSingleQuote) {
                inDoubleQuote = !inDoubleQuote;
            }
            if (c == ';' && !inSingleQuote && !inDoubleQuote) {
                if (!sb.toString().trim().isEmpty()) {
                    statements.add(sb.toString().trim());
                    sb.setLength(0);
                }
            } else {
                sb.append(c);
            }
        }
        if (!sb.toString().trim().isEmpty()) {
            statements.add(sb.toString().trim());
        }
        return statements;
    }

    public static String cleanStatement(String stmt) {
        String[] lines = stmt.split("\n");
        StringBuilder sb = new StringBuilder();
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.startsWith("--") || trimmed.startsWith("#")) {
                continue;
            }
            sb.append(line).append("\n");
        }
        return sb.toString().trim();
    }

    public record SqlAnalysis(
            List<String> statements,
            boolean hasInsert,
            boolean hasSelect,
            boolean hasWith,
            boolean selectOnly,
            boolean singleInsert,
            int insertCount
    ) {
    }
}
