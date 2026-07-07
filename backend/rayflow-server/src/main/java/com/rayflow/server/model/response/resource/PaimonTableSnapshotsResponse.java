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
public class PaimonTableSnapshotsResponse {
    private String databaseName;
    private String tableName;
    private List<String> columns;
    private List<Map<String, Object>> rows;
    private String message;
}
