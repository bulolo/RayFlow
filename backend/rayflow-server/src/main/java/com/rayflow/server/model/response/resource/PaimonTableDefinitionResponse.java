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
public class PaimonTableDefinitionResponse {
    private String databaseName;
    private String tableName;
    private String qualifiedName;
    private Long schemaId;
    private Integer schemaVersion;
    private String comment;
    private List<String> partitionKeys;
    private List<String> primaryKeys;
    private List<String> bucketKeys;
    private Integer numBuckets;
    private Map<String, String> options;
    private String createTableSql;
}
