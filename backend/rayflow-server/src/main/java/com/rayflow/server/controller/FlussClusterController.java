package com.rayflow.server.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.rayflow.common.result.R;
import com.rayflow.server.model.request.resource.FlussClusterRequest;
import com.rayflow.server.model.response.resource.FlussClusterResponse;
import com.rayflow.server.model.entity.FlussCluster;
import com.rayflow.server.model.vo.PageResponse;
import com.rayflow.server.service.FlussClusterService;
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

/**
 * Fluss 集群管理
 */
@Tag(name = "Fluss Cluster Management")
@RestController
@RequestMapping("/api/fluss/clusters")
@RequiredArgsConstructor
public class FlussClusterController {

    private final FlussClusterService flussClusterService;

    @Operation(summary = "获取 Fluss 集群列表", operationId = "listFlussClusters")
    @GetMapping
    public R<PageResponse<FlussClusterResponse>> list(
            @RequestParam(name = "is_pager", defaultValue = "0") int isPager,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        if (isPager != 1) {
            return R.ok(PageResponse.of(flussClusterService.listCurrentTenantClusters(), FlussClusterResponse::from));
        }
        IPage<FlussCluster> clusters = flussClusterService.pageCurrentTenantClusters(
                new Page<>(Math.max(page, 1), Math.max(size, 1))
        );
        return R.ok(PageResponse.from(clusters, FlussClusterResponse::from));
    }

    @Operation(summary = "获取 Fluss 集群详情", operationId = "getFlussCluster")
    @GetMapping("/{id}")
    public R<FlussClusterResponse> detail(@PathVariable Long id) {
        return R.ok(FlussClusterResponse.from(flussClusterService.getRequired(id)));
    }

    @Operation(summary = "创建 Fluss 集群", operationId = "createFlussCluster")
    @PostMapping
    public R<Void> create(@Valid @RequestBody FlussClusterRequest request) {
        flussClusterService.createCluster(toEntity(request));
        return R.ok();
    }

    @Operation(summary = "更新 Fluss 集群", operationId = "updateFlussCluster")
    @PutMapping("/{id}")
    public R<Void> update(@PathVariable Long id, @Valid @RequestBody FlussClusterRequest request) {
        flussClusterService.updateCluster(id, toEntity(request));
        return R.ok();
    }

    @Operation(summary = "检查 Fluss 集群连通性", operationId = "checkFlussCluster")
    @PostMapping("/{id}:check")
    public R<Boolean> check(@PathVariable Long id) {
        return R.ok(flussClusterService.checkCluster(id));
    }

    @Operation(summary = "删除 Fluss 集群", operationId = "deleteFlussCluster")
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable Long id) {
        flussClusterService.deleteCluster(id);
        return R.ok();
    }

    private static FlussCluster toEntity(FlussClusterRequest request) {
        FlussCluster cluster = new FlussCluster();
        cluster.setClusterName(request.getClusterName());
        cluster.setBootstrapServers(request.getBootstrapServers());
        cluster.setDefaultDatabase(request.getDefaultDatabase());
        cluster.setStatus(request.getStatus());
        cluster.setDescription(request.getDescription());
        return cluster;
    }
}
