package com.rayflow.server.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.rayflow.common.result.R;
import com.rayflow.server.model.request.resource.StarRocksConnectionRequest;
import com.rayflow.server.model.request.resource.StarRocksDdlRequest;
import com.rayflow.server.model.request.resource.StarRocksSqlQueryRequest;
import com.rayflow.server.model.response.resource.StarRocksConnectionResponse;
import com.rayflow.server.model.response.resource.StarRocksDatabaseResponse;
import com.rayflow.server.model.response.resource.StarRocksObjectDefinitionResponse;
import com.rayflow.server.model.response.resource.StarRocksObjectResponse;
import com.rayflow.server.model.response.resource.StarRocksObjectSchemaResponse;
import com.rayflow.server.model.response.resource.StarRocksPreviewResponse;
import com.rayflow.server.model.entity.StarRocksConnection;
import com.rayflow.server.model.vo.PageResponse;
import com.rayflow.server.service.StarRocksBrowserService;
import com.rayflow.server.service.StarRocksConnectionService;
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
 * StarRocks connection management.
 */
@Tag(name = "StarRocks Connection Management")
@RestController
@RequestMapping("/api/starrocks/connections")
@RequiredArgsConstructor
public class StarRocksConnectionController {

    private final StarRocksConnectionService starRocksConnectionService;
    private final StarRocksBrowserService starRocksBrowserService;

    @Operation(summary = "获取 StarRocks 连接列表", operationId = "listStarRocksConnections")
    @GetMapping
    public R<PageResponse<StarRocksConnectionResponse>> list(
            @RequestParam(name = "is_pager", defaultValue = "0") int isPager,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        if (isPager != 1) {
            return R.ok(PageResponse.of(starRocksConnectionService.listCurrentTenantConnections(), StarRocksConnectionResponse::from));
        }
        IPage<StarRocksConnection> connections = starRocksConnectionService.pageCurrentTenantConnections(
                new Page<>(Math.max(page, 1), Math.max(size, 1))
        );
        return R.ok(PageResponse.from(connections, StarRocksConnectionResponse::from));
    }

    @Operation(summary = "获取 StarRocks 连接详情", operationId = "getStarRocksConnection")
    @GetMapping("/{id}")
    public R<StarRocksConnectionResponse> detail(@PathVariable Long id) {
        return R.ok(StarRocksConnectionResponse.from(starRocksConnectionService.getRequired(id)));
    }

    @Operation(summary = "创建 StarRocks 连接", operationId = "createStarRocksConnection")
    @PostMapping
    public R<Void> create(@Valid @RequestBody StarRocksConnectionRequest request) {
        starRocksConnectionService.createConnection(toEntity(request));
        return R.ok();
    }

    @Operation(summary = "更新 StarRocks 连接", operationId = "updateStarRocksConnection")
    @PutMapping("/{id}")
    public R<Void> update(@PathVariable Long id, @Valid @RequestBody StarRocksConnectionRequest request) {
        starRocksConnectionService.updateConnection(id, toEntity(request));
        return R.ok();
    }

    @Operation(summary = "检查 StarRocks 连接", operationId = "checkStarRocksConnection")
    @PostMapping("/{id}:check")
    public R<Boolean> check(@PathVariable Long id) {
        return R.ok(starRocksConnectionService.checkConnection(id));
    }

    @Operation(summary = "浏览 StarRocks Database 列表", operationId = "listStarRocksDatabases")
    @GetMapping("/{id}/databases")
    public R<List<StarRocksDatabaseResponse>> listDatabases(
            @PathVariable Long id,
            @RequestParam(defaultValue = "false") boolean refresh) {
        return R.ok(starRocksBrowserService.listDatabases(id, refresh));
    }

    @Operation(summary = "浏览 StarRocks 对象列表", operationId = "listStarRocksObjects")
    @GetMapping("/{id}/databases/{databaseName}/objects")
    public R<List<StarRocksObjectResponse>> listObjects(
            @PathVariable Long id,
            @PathVariable String databaseName,
            @RequestParam(defaultValue = "false") boolean refresh) {
        return R.ok(starRocksBrowserService.listObjects(id, databaseName, refresh));
    }

    @Operation(summary = "浏览 StarRocks 对象 Schema", operationId = "getStarRocksObjectSchema")
    @GetMapping("/{id}/databases/{databaseName}/objects/{objectName}/schema")
    public R<StarRocksObjectSchemaResponse> getObjectSchema(
            @PathVariable Long id,
            @PathVariable String databaseName,
            @PathVariable String objectName,
            @RequestParam(defaultValue = "false") boolean refresh) {
        return R.ok(starRocksBrowserService.getSchema(id, databaseName, objectName, refresh));
    }

    @Operation(summary = "浏览 StarRocks 对象定义", operationId = "getStarRocksObjectDefinition")
    @GetMapping("/{id}/databases/{databaseName}/objects/{objectName}/definition")
    public R<StarRocksObjectDefinitionResponse> getObjectDefinition(
            @PathVariable Long id,
            @PathVariable String databaseName,
            @PathVariable String objectName,
            @RequestParam(defaultValue = "false") boolean refresh) {
        return R.ok(starRocksBrowserService.getDefinition(id, databaseName, objectName, refresh));
    }

    @Operation(summary = "浏览 StarRocks 对象分区", operationId = "listStarRocksObjectPartitions")
    @GetMapping("/{id}/databases/{databaseName}/objects/{objectName}/partitions")
    public R<StarRocksPreviewResponse> listObjectPartitions(
            @PathVariable Long id,
            @PathVariable String databaseName,
            @PathVariable String objectName,
            @RequestParam(defaultValue = "false") boolean refresh) {
        return R.ok(starRocksBrowserService.listPartitions(id, databaseName, objectName, refresh));
    }

    @Operation(summary = "预览 StarRocks 对象数据", operationId = "previewStarRocksObject")
    @GetMapping("/{id}/databases/{databaseName}/objects/{objectName}/preview")
    public R<StarRocksPreviewResponse> previewObject(
            @PathVariable Long id,
            @PathVariable String databaseName,
            @PathVariable String objectName,
            @RequestParam(defaultValue = "100") Integer limit) {
        return R.ok(starRocksBrowserService.preview(id, databaseName, objectName, limit));
    }

    @Operation(summary = "执行 StarRocks 建表或物化视图 DDL", operationId = "executeStarRocksDdl")
    @PostMapping("/{id}/ddl")
    public R<Void> executeDdl(@PathVariable Long id, @Valid @RequestBody StarRocksDdlRequest request) {
        starRocksBrowserService.executeDdl(id, request);
        return R.ok();
    }

    @Operation(summary = "执行 StarRocks SQL 命令", operationId = "executeStarRocksQuery")
    @PostMapping("/{id}/query")
    public R<StarRocksPreviewResponse> executeQuery(@PathVariable Long id, @Valid @RequestBody StarRocksSqlQueryRequest request) {
        return R.ok(starRocksBrowserService.executeQuery(id, request));
    }

    @Operation(summary = "删除 StarRocks 连接", operationId = "deleteStarRocksConnection")
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable Long id) {
        starRocksConnectionService.deleteConnection(id);
        return R.ok();
    }

    private static StarRocksConnection toEntity(StarRocksConnectionRequest request) {
        StarRocksConnection connection = new StarRocksConnection();
        connection.setConnectionName(request.getConnectionName());
        connection.setFeAddress(request.getFeAddress());
        connection.setQueryPort(request.getQueryPort());
        connection.setUsername(request.getUsername());
        connection.setPassword(request.getPassword());
        connection.setDefaultDatabase(request.getDefaultDatabase());
        connection.setStatus(request.getStatus());
        connection.setDescription(request.getDescription());
        return connection;
    }
}
