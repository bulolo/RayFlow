package com.rayflow.flink.sqlrunner;

import org.apache.flink.api.common.functions.OpenContext;
import org.apache.flink.configuration.Configuration;
import org.apache.flink.streaming.api.functions.sink.legacy.RichSinkFunction;
import org.apache.flink.types.Row;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class PreviewCollectSink extends RichSinkFunction<Row> {

    private final String callbackUrl;
    private final String callbackToken;
    private final int limit;
    private final String previewType;
    private final List<PreviewResultColumn> columns;

    private transient PreviewResultCallbackClient callbackClient;
    private transient List<Map<String, Object>> rows;
    private transient boolean truncated;

    PreviewCollectSink(String callbackUrl, String callbackToken, int limit, String previewType, List<PreviewResultColumn> columns) {
        this.callbackUrl = callbackUrl;
        this.callbackToken = callbackToken;
        this.limit = limit;
        this.previewType = previewType;
        this.columns = columns;
    }

    @Override
    public void open(OpenContext openContext) {
        this.callbackClient = new PreviewResultCallbackClient();
        this.rows = new ArrayList<>();
        this.truncated = false;
    }

    @Override
    public void invoke(Row value, Context context) {
        if (rows.size() >= limit) {
            truncated = true;
            return;
        }
        Map<String, Object> record = new LinkedHashMap<>();
        for (int i = 0; i < columns.size(); i++) {
            Object field = i < value.getArity() ? value.getField(i) : null;
            record.put(columns.get(i).getName(), normalizeValue(field));
        }
        rows.add(record);
    }

    @Override
    public void close() {
        if (callbackClient != null) {
            callbackClient.reportSuccess(callbackUrl, callbackToken, rows, columns, truncated, previewType);
        }
    }

    private Object normalizeValue(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number || value instanceof Boolean || value instanceof CharSequence) {
            return value;
        }
        return value.toString();
    }
}
