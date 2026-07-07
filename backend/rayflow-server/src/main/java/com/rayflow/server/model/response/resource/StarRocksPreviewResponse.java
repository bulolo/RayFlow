package com.rayflow.server.model.response.resource;

import io.swagger.v3.oas.annotations.media.Schema;
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
public class StarRocksPreviewResponse {
    private String databaseName;
    private String objectName;
    private List<Column> columns;
    private List<Map<String, Object>> data;
    private Boolean truncated;
    private String message;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "StarRocksPreviewColumn")
    public static class Column {
        private String name;
        private String type;
    }
}
