package com.rayflow.server.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.rayflow.common.result.R;
import com.rayflow.server.model.entity.FlinkJarResource;
import com.rayflow.server.model.request.resource.FlinkJarResourceRequest;
import com.rayflow.server.model.response.resource.FlinkJarResourceResponse;
import com.rayflow.server.model.vo.PageResponse;
import com.rayflow.server.service.FlinkJarResourceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Flink Jar Resource Management")
@RestController
@RequestMapping("/api/flink/jar-resources")
@RequiredArgsConstructor
public class FlinkJarResourceController {

    private final FlinkJarResourceService flinkJarResourceService;

    @Operation(summary = "获取 Flink JAR 资源列表", operationId = "listFlinkJarResources")
    @GetMapping
    public R<PageResponse<FlinkJarResourceResponse>> list(
            @RequestParam(name = "is_pager", defaultValue = "0") int isPager,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        if (isPager != 1) {
            return R.ok(PageResponse.of(flinkJarResourceService.listCurrentTenantResources(), FlinkJarResourceResponse::from));
        }
        IPage<FlinkJarResource> resources = flinkJarResourceService.pageCurrentTenantResources(
                new Page<>(Math.max(page, 1), Math.max(size, 1))
        );
        return R.ok(PageResponse.from(resources, FlinkJarResourceResponse::from));
    }

    @Operation(summary = "获取 Flink JAR 资源详情", operationId = "getFlinkJarResource")
    @GetMapping("/{id}")
    public R<FlinkJarResourceResponse> detail(@PathVariable Long id) {
        return R.ok(FlinkJarResourceResponse.from(flinkJarResourceService.getRequired(id)));
    }

    @Operation(summary = "创建 Flink JAR 资源", operationId = "createFlinkJarResource")
    @PostMapping
    public R<Void> create(@Valid @RequestBody FlinkJarResourceRequest request) {
        flinkJarResourceService.createResource(toEntity(request));
        return R.ok();
    }

    @Operation(summary = "上传 Flink JAR 资源", operationId = "uploadFlinkJarResource")
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public R<FlinkJarResourceResponse> upload(
            @RequestPart("file") MultipartFile file,
            @RequestParam(required = false) String resourceName,
            @RequestParam(required = false) String resourceVersion,
            @RequestParam(required = false, defaultValue = "2.x") String compatibleFlinkVersion,
            @RequestParam(required = false, defaultValue = "ACTIVE") String status) {
        FlinkJarResource resource = new FlinkJarResource();
        resource.setResourceName(resourceName);
        resource.setResourceVersion(resourceVersion);
        resource.setCompatibleFlinkVersion(compatibleFlinkVersion);
        resource.setStatus(status);
        return R.ok(FlinkJarResourceResponse.from(flinkJarResourceService.uploadResource(file, resource)));
    }

    @Operation(summary = "更新 Flink JAR 资源", operationId = "updateFlinkJarResource")
    @PutMapping("/{id}")
    public R<Void> update(@PathVariable Long id, @Valid @RequestBody FlinkJarResourceRequest request) {
        flinkJarResourceService.updateResource(id, toEntity(request));
        return R.ok();
    }

    @Operation(summary = "删除 Flink JAR 资源", operationId = "deleteFlinkJarResource")
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable Long id) {
        flinkJarResourceService.deleteResource(id);
        return R.ok();
    }

    private static FlinkJarResource toEntity(FlinkJarResourceRequest request) {
        FlinkJarResource resource = new FlinkJarResource();
        resource.setResourceName(request.getResourceName());
        resource.setResourceVersion(request.getResourceVersion());
        resource.setCompatibleFlinkVersion(request.getCompatibleFlinkVersion());
        resource.setStorageUri(request.getStorageUri());
        resource.setChecksum(request.getChecksum());
        resource.setStatus(request.getStatus());
        return resource;
    }
}
