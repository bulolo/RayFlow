package com.rayflow.server.controller;

import com.rayflow.common.result.R;
import com.rayflow.server.model.request.flink.FlinkSqlPreviewRequest;
import com.rayflow.server.model.request.flink.FlinkSqlValidateRequest;
import com.rayflow.server.model.response.flink.FlinkSqlPreviewResponse;
import com.rayflow.server.model.response.flink.FlinkSqlValidateResponse;
import com.rayflow.server.service.FlinkSqlPreviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Flink SQL 交互式调试与数据预览
 */
@Tag(name = "Flink SQL Debugging")
@RestController
@RequestMapping("/api/flink")
@RequiredArgsConstructor
public class FlinkSqlPreviewController {

    private final FlinkSqlPreviewService previewService;

    @Operation(summary = "提交 SQL 调试预览", operationId = "executeFlinkSqlPreview")
    @PostMapping("/sql:preview")
    public R<FlinkSqlPreviewResponse> preview(@Valid @RequestBody FlinkSqlPreviewRequest request) {
        return R.ok(previewService.executePreview(request));
    }

    @Operation(summary = "校验 Flink SQL", operationId = "validateFlinkSql")
    @PostMapping("/sql:validate")
    public R<FlinkSqlValidateResponse> validate(@Valid @RequestBody FlinkSqlValidateRequest request) {
        return R.ok(previewService.validate(request));
    }
}
