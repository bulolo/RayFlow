package com.rayflow.server.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.rayflow.common.result.R;
import com.rayflow.server.model.request.flink.FlinkClusterRequest;
import com.rayflow.server.model.response.flink.FlinkClusterCheckResponse;
import com.rayflow.server.model.response.flink.FlinkClusterResponse;
import com.rayflow.server.model.entity.FlinkCluster;
import com.rayflow.server.model.vo.PageResponse;
import com.rayflow.server.service.FlinkClusterService;
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
 * Flink 运行时管理
 */
@Tag(name = "Flink Runtime Management")
@RestController
@RequestMapping("/api/flink/runtimes")
@RequiredArgsConstructor
public class ClusterController {

    private final FlinkClusterService clusterService;

    @Operation(summary = "获取运行时列表", operationId = "listFlinkRuntimes")
    @GetMapping
    public R<PageResponse<FlinkClusterResponse>> list(
            @RequestParam(name = "is_pager", defaultValue = "0") int isPager,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        if (isPager != 1) {
            return R.ok(PageResponse.of(clusterService.listCurrentTenantClusters(), FlinkClusterResponse::from));
        }
        IPage<FlinkCluster> clusters = clusterService.pageCurrentTenantClusters(
                new Page<>(Math.max(page, 1), Math.max(size, 1))
        );
        return R.ok(PageResponse.from(clusters, FlinkClusterResponse::from));
    }

    @Operation(summary = "获取运行时详情", operationId = "getFlinkRuntime")
    @GetMapping("/{id}")
    public R<FlinkClusterResponse> detail(@PathVariable Long id) {
        return R.ok(FlinkClusterResponse.from(clusterService.getRequired(id)));
    }

    @Operation(summary = "添加运行时", operationId = "createFlinkRuntime")
    @PostMapping
    public R<Void> create(@Valid @RequestBody FlinkClusterRequest request) {
        clusterService.createCluster(toEntity(request));
        return R.ok();
    }

    @Operation(summary = "更新运行时", operationId = "updateFlinkRuntime")
    @PutMapping("/{id}")
    public R<Void> update(@PathVariable Long id, @Valid @RequestBody FlinkClusterRequest request) {
        clusterService.updateCluster(id, toEntity(request));
        return R.ok();
    }

    @Operation(summary = "检查运行时连通性", operationId = "checkFlinkRuntime")
    @PostMapping("/{id}:check")
    public R<FlinkClusterCheckResponse> check(@PathVariable Long id) {
        return R.ok(clusterService.checkCluster(id));
    }

    @Operation(summary = "删除运行时", operationId = "deleteFlinkRuntime")
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable Long id) {
        clusterService.deleteCluster(id);
        return R.ok();
    }

    private static FlinkCluster toEntity(FlinkClusterRequest request) {
        FlinkCluster cluster = new FlinkCluster();
        cluster.setClusterName(request.getClusterName());
        cluster.setClusterType(request.getClusterType());
        cluster.setDeploymentMode(request.getDeploymentMode());
        cluster.setAddress(request.getAddress());
        cluster.setGatewayAddress(request.getGatewayAddress());
        cluster.setFlinkVersion(request.getFlinkVersion());
        cluster.setNamespaceName(request.getNamespaceName());
        cluster.setServiceAccount(request.getServiceAccount());
        cluster.setImage(request.getImage());
        cluster.setImagePullPolicy(request.getImagePullPolicy());
        cluster.setServiceExposureType(request.getServiceExposureType());
        cluster.setKubeConfigRef(request.getKubeConfigRef());
        cluster.setPodTemplate(request.getPodTemplate());
        cluster.setDefaultParallelism(request.getDefaultParallelism());
        cluster.setCheckpointDir(request.getCheckpointDir());
        cluster.setSavepointDir(request.getSavepointDir());
        cluster.setDescription(request.getDescription());
        cluster.setStatus("UNREACHABLE");
        return cluster;
    }
}
