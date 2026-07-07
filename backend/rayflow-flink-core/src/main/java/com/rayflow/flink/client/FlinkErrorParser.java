package com.rayflow.flink.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.client.HttpStatusCodeException;

import java.io.PrintWriter;
import java.io.StringWriter;

@Slf4j
public class FlinkErrorParser {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    public static String parse(Throwable e) {
        if (e == null) {
            return "未知错误";
        }

        String body = null;
        Throwable current = e;
        while (current != null) {
            if (current instanceof HttpStatusCodeException) {
                body = ((HttpStatusCodeException) current).getResponseBodyAsString();
                break;
            }
            current = current.getCause();
        }

        if (body != null && !body.isBlank()) {
            try {
                JsonNode node = objectMapper.readTree(body);
                if (node.has("errors")) {
                    JsonNode errorsNode = node.get("errors");
                    if (errorsNode.isArray() && errorsNode.size() > 0) {
                        String stackTrace = errorsNode.get(0).asText();
                        return extractRootCause(stackTrace);
                    }
                }
            } catch (Exception ignored) {
            }
        }

        String rawMessage = e.getMessage();
        if (rawMessage != null) {
            // Check if there is JSON nested in the exception message
            int jsonStart = rawMessage.indexOf('{');
            if (jsonStart >= 0) {
                int jsonEnd = rawMessage.lastIndexOf('}');
                if (jsonEnd > jsonStart) {
                    try {
                        String potentialJson = rawMessage.substring(jsonStart, jsonEnd + 1);
                        JsonNode node = objectMapper.readTree(potentialJson);
                        if (node.has("errors")) {
                            JsonNode errorsNode = node.get("errors");
                            if (errorsNode.isArray() && errorsNode.size() > 0) {
                                return extractRootCause(errorsNode.get(0).asText());
                            }
                        }
                    } catch (Exception ignored) {
                    }
                }
            }
            return extractRootCause(rawMessage);
        }

        return e.toString();
    }

    public static String formatFull(Throwable e) {
        if (e == null) {
            return "未知错误";
        }
        String body = findFlinkErrorBody(e);
        if (body != null && !body.isBlank()) {
            String parsed = formatFlinkErrorBody(body);
            if (parsed != null && !parsed.isBlank()) {
                return parsed;
            }
        }

        StringWriter writer = new StringWriter();
        e.printStackTrace(new PrintWriter(writer));
        return writer.toString().trim();
    }

    private static String findFlinkErrorBody(Throwable e) {
        Throwable current = e;
        while (current != null) {
            if (current instanceof HttpStatusCodeException httpError) {
                String body = httpError.getResponseBodyAsString();
                if (body != null && !body.isBlank()) {
                    return body;
                }
            }
            String body = extractJsonBody(current.getMessage());
            if (body != null && !body.isBlank()) {
                return body;
            }
            current = current.getCause();
        }
        return null;
    }

    private static String extractJsonBody(String message) {
        if (message == null || message.isBlank()) {
            return null;
        }
        int start = message.indexOf('{');
        int end = message.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        String body = message.substring(start, end + 1);
        try {
            JsonNode node = objectMapper.readTree(body);
            return node.has("errors") ? body : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String formatFlinkErrorBody(String body) {
        try {
            JsonNode node = objectMapper.readTree(body);
            if (!node.has("errors")) {
                return null;
            }
            JsonNode errorsNode = node.get("errors");
            if (!errorsNode.isArray() || errorsNode.isEmpty()) {
                return null;
            }
            StringBuilder result = new StringBuilder();
            for (JsonNode error : errorsNode) {
                if (!result.isEmpty()) {
                    result.append("\n\n---\n\n");
                }
                result.append(error.asText());
            }
            return result.toString();
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String extractRootCause(String stackTrace) {
        if (stackTrace == null || stackTrace.isBlank()) {
            return "未知错误";
        }

        String[] lines = stackTrace.split("\n");
        String lastCausedBy = null;
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.startsWith("Caused by:")) {
                lastCausedBy = trimmed;
            }
        }

        if (lastCausedBy != null) {
            String cause = lastCausedBy.substring(10).trim(); // remove "Caused by:"
            int colonIndex = cause.indexOf(':');
            if (colonIndex > 0) {
                String className = cause.substring(0, colonIndex).trim();
                if (className.contains(".")) {
                    return cause.substring(colonIndex + 1).trim();
                }
            }
            return cause;
        }

        if (lines.length > 0) {
            String firstLine = lines[0].trim();
            int colonIndex = firstLine.indexOf(':');
            if (colonIndex > 0) {
                String className = firstLine.substring(0, colonIndex).trim();
                if (className.contains(".")) {
                    return firstLine.substring(colonIndex + 1).trim();
                }
            }
            return firstLine;
        }

        return stackTrace;
    }
}
