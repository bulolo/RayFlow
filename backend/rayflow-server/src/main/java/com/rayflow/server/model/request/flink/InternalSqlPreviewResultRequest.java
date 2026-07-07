package com.rayflow.server.model.request.flink;

import com.rayflow.server.model.response.flink.FlinkSqlPreviewResponse;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class InternalSqlPreviewResultRequest {

    @NotNull
    private Boolean success;

    private String previewType;

    private List<FlinkSqlPreviewResponse.ColumnInfo> columns;

    private List<Map<String, Object>> data;

    private Boolean truncated = false;

    private String errorMessage;
}
