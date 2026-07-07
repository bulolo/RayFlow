package com.rayflow.server.controller;

import com.rayflow.common.result.R;
import com.rayflow.server.model.request.flink.InternalSqlPreviewResultRequest;
import com.rayflow.server.service.FlinkSqlPreviewResultStore;
import io.swagger.v3.oas.annotations.Hidden;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Hidden
@RequestMapping("/internal/flink/sql-preview-results")
@RequiredArgsConstructor
public class InternalFlinkSqlPreviewController {

    private static final String TOKEN_HEADER = "X-RayFlow-Preview-Token";

    private final FlinkSqlPreviewResultStore previewResultStore;

    @Value("${rayflow.preview.callback-token:}")
    private String callbackToken;

    @PostMapping("/{previewId}")
    public R<Void> completePreview(
            @PathVariable String previewId,
            @RequestHeader(name = TOKEN_HEADER, required = false) String token,
            @Valid @RequestBody InternalSqlPreviewResultRequest request
    ) {
        if (callbackToken == null || callbackToken.isBlank() || !callbackToken.equals(token)) {
            return R.fail(403, "preview callback token invalid");
        }
        if (Boolean.TRUE.equals(request.getSuccess())) {
            previewResultStore.complete(
                    previewId,
                    request.getPreviewType(),
                    request.getColumns(),
                    request.getData(),
                    Boolean.TRUE.equals(request.getTruncated())
            );
        } else {
            previewResultStore.fail(previewId, request.getErrorMessage());
        }
        return R.ok();
    }
}
