package com.rayflow.server.model.response.resource;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaimonTableFileContentResponse {
    private String databaseName;
    private String tableName;
    private String tablePath;
    private String path;
    private String name;
    private String contentType;
    private Long size;
    private Boolean truncated;
    private Boolean viewable;
    private String content;
    private List<String> columns;
    private List<Map<String, Object>> rows;
    private String message;
}
