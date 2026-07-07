package com.rayflow.server.model.response.resource;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StarRocksObjectDefinitionResponse {
    private String databaseName;
    private String objectName;
    private String objectType;
    private String createSql;
}
