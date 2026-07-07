package com.rayflow.server.model.response.flink;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
@Schema(name = "FlinkRuntimeCheckResponse")
public class FlinkClusterCheckResponse {

    private boolean clusterReachable;

    private String clusterStatus;

    private String gatewayStatus;

    private String flinkVersion;
}
