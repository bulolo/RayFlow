package com.rayflow.server.model.response.flink;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Flink SQL 预览调试响应 DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FlinkSqlPreviewResponse {

    /** 预览结果类型: TABLE / SINK_TABLE */
    private String previewType;

    /** 结果集列定义 */
    private List<ColumnInfo> columns;

    /** 结果数据矩阵（每行以 key-value 映射表示） */
    private List<Map<String, Object>> data;

    /** 是否被截断 */
    private Boolean truncated;

    /** 额外提示信息 */
    private String message;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ColumnInfo {
        private String name;
        private String type;
    }
}
