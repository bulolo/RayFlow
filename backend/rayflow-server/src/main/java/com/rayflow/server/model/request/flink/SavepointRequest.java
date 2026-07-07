package com.rayflow.server.model.request.flink;

import lombok.Data;

/**
 * Savepoint 触发请求
 */
@Data
public class SavepointRequest {

    private String targetDirectory;

    private Boolean cancelJob = false;
}
