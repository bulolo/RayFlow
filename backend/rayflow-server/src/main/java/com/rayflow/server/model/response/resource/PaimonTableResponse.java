package com.rayflow.server.model.response.resource;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PaimonTableResponse {
    private String databaseName;
    private String tableName;
}
