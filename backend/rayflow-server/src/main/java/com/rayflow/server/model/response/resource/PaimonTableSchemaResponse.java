package com.rayflow.server.model.response.resource;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaimonTableSchemaResponse {
    private String databaseName;
    private String tableName;
    private List<Column> columns;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "PaimonTableSchemaColumn")
    public static class Column {
        private String name;
        private String type;
        private String nullable;
        private String key;
        private String extras;
        private String watermark;
    }
}
