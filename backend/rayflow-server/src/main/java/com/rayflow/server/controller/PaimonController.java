package com.rayflow.server.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.rayflow.common.result.R;
import com.rayflow.server.model.request.resource.PaimonCatalogRequest;
import com.rayflow.server.model.response.resource.PaimonCatalogDetailResponse;
import com.rayflow.server.model.response.resource.PaimonCatalogResponse;
import com.rayflow.server.model.response.resource.PaimonDatabaseResponse;
import com.rayflow.server.model.response.resource.PaimonTableDefinitionResponse;
import com.rayflow.server.model.response.resource.PaimonTableFileContentResponse;
import com.rayflow.server.model.response.resource.PaimonTableFilesResponse;
import com.rayflow.server.model.response.resource.PaimonTablePreviewResponse;
import com.rayflow.server.model.response.resource.PaimonTableResponse;
import com.rayflow.server.model.response.resource.PaimonTableSchemaResponse;
import com.rayflow.server.model.response.resource.PaimonTableSnapshotsResponse;
import com.rayflow.server.model.entity.PaimonCatalog;
import com.rayflow.server.model.vo.PageResponse;
import com.rayflow.server.service.PaimonCatalogBrowserService;
import com.rayflow.server.service.PaimonCatalogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Paimon 管理
 */
@Tag(name = "Paimon Management")
@RestController
@RequestMapping("/api/paimon/catalogs")
@RequiredArgsConstructor
public class PaimonController {

    private final PaimonCatalogService paimonCatalogService;
    private final PaimonCatalogBrowserService paimonCatalogBrowserService;

    @Operation(summary = "获取 Catalog 列表", operationId = "listPaimonCatalogs")
    @GetMapping
    public R<PageResponse<PaimonCatalogResponse>> list(
            @RequestParam(name = "is_pager", defaultValue = "0") int isPager,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        if (isPager != 1) {
            return R.ok(PageResponse.of(paimonCatalogService.listCurrentTenantCatalogs(), PaimonCatalogResponse::from));
        }
        IPage<PaimonCatalog> catalogs = paimonCatalogService.pageCurrentTenantCatalogs(
                new Page<>(Math.max(page, 1), Math.max(size, 1))
        );
        return R.ok(PageResponse.from(catalogs, PaimonCatalogResponse::from));
    }

    @Operation(summary = "获取 Catalog 详情", operationId = "getPaimonCatalog")
    @GetMapping("/{id}")
    public R<PaimonCatalogDetailResponse> detail(@PathVariable Long id) {
        return R.ok(PaimonCatalogDetailResponse.from(paimonCatalogService.getRequired(id)));
    }

    @Operation(summary = "创建 Catalog", operationId = "createPaimonCatalog")
    @PostMapping
    public R<Void> create(@Valid @RequestBody PaimonCatalogRequest request) {
        paimonCatalogService.createCatalog(toEntity(request));
        return R.ok();
    }

    @Operation(summary = "更新 Catalog", operationId = "updatePaimonCatalog")
    @PutMapping("/{id}")
    public R<Void> update(@PathVariable Long id, @Valid @RequestBody PaimonCatalogRequest request) {
        paimonCatalogService.updateCatalog(id, toEntity(request));
        return R.ok();
    }

    @Operation(summary = "检查 Catalog 连通性", operationId = "checkPaimonCatalog")
    @PostMapping("/{id}:check")
    public R<Boolean> check(@PathVariable Long id) {
        return R.ok(paimonCatalogService.checkCatalog(id));
    }

    @Operation(summary = "浏览 Paimon Database 列表", operationId = "listPaimonDatabases")
    @GetMapping("/{id}/databases")
    public R<List<PaimonDatabaseResponse>> listDatabases(
            @PathVariable Long id,
            @RequestParam(defaultValue = "false") boolean refresh) {
        return R.ok(paimonCatalogBrowserService.listDatabases(id, refresh));
    }

    @Operation(summary = "浏览 Paimon Table 列表", operationId = "listPaimonTables")
    @GetMapping("/{id}/databases/{databaseName}/tables")
    public R<List<PaimonTableResponse>> listTables(
            @PathVariable Long id,
            @PathVariable String databaseName,
            @RequestParam(defaultValue = "false") boolean refresh) {
        return R.ok(paimonCatalogBrowserService.listTables(id, databaseName, refresh));
    }

    @Operation(summary = "浏览 Paimon Table Schema", operationId = "getPaimonTableSchema")
    @GetMapping("/{id}/databases/{databaseName}/tables/{tableName}/schema")
    public R<PaimonTableSchemaResponse> getTableSchema(
            @PathVariable Long id,
            @PathVariable String databaseName,
            @PathVariable String tableName,
            @RequestParam(defaultValue = "false") boolean refresh) {
        return R.ok(paimonCatalogBrowserService.getTableSchema(id, databaseName, tableName, refresh));
    }

    @Operation(summary = "浏览 Paimon Table 定义", operationId = "getPaimonTableDefinition")
    @GetMapping("/{id}/databases/{databaseName}/tables/{tableName}/definition")
    public R<PaimonTableDefinitionResponse> getTableDefinition(
            @PathVariable Long id,
            @PathVariable String databaseName,
            @PathVariable String tableName,
            @RequestParam(defaultValue = "false") boolean refresh) {
        return R.ok(paimonCatalogBrowserService.getTableDefinition(id, databaseName, tableName, refresh));
    }

    @Operation(summary = "浏览 Paimon Table 文件目录", operationId = "listPaimonTableFiles")
    @GetMapping("/{id}/databases/{databaseName}/tables/{tableName}/files")
    public R<PaimonTableFilesResponse> listTableFiles(
            @PathVariable Long id,
            @PathVariable String databaseName,
            @PathVariable String tableName,
            @RequestParam(required = false) String path,
            @RequestParam(defaultValue = "false") boolean refresh) {
        return R.ok(paimonCatalogBrowserService.listTableFiles(id, databaseName, tableName, path, refresh));
    }

    @Operation(summary = "预览 Paimon Table 文件内容", operationId = "getPaimonTableFileContent")
    @GetMapping("/{id}/databases/{databaseName}/tables/{tableName}/files/content")
    public R<PaimonTableFileContentResponse> getTableFileContent(
            @PathVariable Long id,
            @PathVariable String databaseName,
            @PathVariable String tableName,
            @RequestParam String path) {
        return R.ok(paimonCatalogBrowserService.getTableFileContent(id, databaseName, tableName, path));
    }

    @Operation(summary = "浏览 Paimon Table Snapshot 列表", operationId = "listPaimonTableSnapshots")
    @GetMapping("/{id}/databases/{databaseName}/tables/{tableName}/snapshots")
    public R<PaimonTableSnapshotsResponse> listTableSnapshots(
            @PathVariable Long id,
            @PathVariable String databaseName,
            @PathVariable String tableName) {
        return R.ok(paimonCatalogBrowserService.listTableSnapshots(id, databaseName, tableName));
    }

    @Operation(summary = "预览 Paimon Table 数据", operationId = "previewPaimonTable")
    @GetMapping("/{id}/databases/{databaseName}/tables/{tableName}/preview")
    public R<PaimonTablePreviewResponse> previewTable(
            @PathVariable Long id,
            @PathVariable String databaseName,
            @PathVariable String tableName,
            @RequestParam(defaultValue = "100") Integer limit) {
        return R.ok(paimonCatalogBrowserService.previewTable(id, databaseName, tableName, limit));
    }

    @Operation(summary = "删除 Catalog", operationId = "deletePaimonCatalog")
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable Long id) {
        paimonCatalogService.deleteCatalog(id);
        return R.ok();
    }

    private static PaimonCatalog toEntity(PaimonCatalogRequest request) {
        PaimonCatalog catalog = new PaimonCatalog();
        catalog.setCatalogName(request.getCatalogName());
        catalog.setWarehouse(request.getWarehouse());
        catalog.setMetastoreType(request.getMetastoreType());
        catalog.setOptions(request.getOptions());
        catalog.setStatus(request.getStatus());
        catalog.setDescription(request.getDescription());
        return catalog;
    }
}
