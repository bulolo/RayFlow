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
public class StarRocksObjectSchemaResponse {
    private String databaseName;
    private String objectName;
    private List<Column> columns;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "StarRocksObjectSchemaColumn")
    public static class Column {
        private String name;
        private String type;
        private String nullable;
        private String key;
        private String defaultValue;
        private String extra;
    }
}
