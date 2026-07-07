package com.rayflow.server.model.response.flink;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FlinkSqlValidateResponse {

    private Boolean valid;

    private String message;

    private Integer line;

    private Integer column;

    private Integer statementCount;
}
