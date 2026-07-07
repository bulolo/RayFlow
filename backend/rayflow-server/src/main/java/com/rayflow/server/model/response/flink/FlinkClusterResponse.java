package com.rayflow.server.model.response.flink;

import com.rayflow.server.model.entity.FlinkCluster;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
@Schema(name = "FlinkRuntimeResponse")
public class FlinkClusterResponse {

    private Long id;
    private String clusterName;
    private String clusterType;
    private String deploymentMode;
    private String address;
    private String status;
    private String flinkVersion;
    private String description;
    private String gatewayAddress;
    private String gatewayStatus;
    private String namespaceName;
    private String serviceAccount;
    private String image;
    private String imagePullPolicy;
    private String serviceExposureType;
    private String kubeConfigRef;
    private String podTemplate;
    private Integer defaultParallelism;
    private String checkpointDir;
    private String savepointDir;
    private String clusterScope;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static FlinkClusterResponse from(FlinkCluster cluster) {
        return FlinkClusterResponse.builder()
                .id(cluster.getId())
                .clusterName(cluster.getClusterName())
                .clusterType(cluster.getClusterType())
                .deploymentMode(cluster.getDeploymentMode())
                .address(cluster.getAddress())
                .status(cluster.getStatus())
                .flinkVersion(cluster.getFlinkVersion())
                .description(cluster.getDescription())
                .gatewayAddress(cluster.getGatewayAddress())
                .gatewayStatus(cluster.getGatewayStatus())
                .namespaceName(cluster.getNamespaceName())
                .serviceAccount(cluster.getServiceAccount())
                .image(cluster.getImage())
                .imagePullPolicy(cluster.getImagePullPolicy())
                .serviceExposureType(cluster.getServiceExposureType())
                .kubeConfigRef(cluster.getKubeConfigRef())
                .podTemplate(cluster.getPodTemplate())
                .defaultParallelism(cluster.getDefaultParallelism())
                .checkpointDir(cluster.getCheckpointDir())
                .savepointDir(cluster.getSavepointDir())
                .clusterScope(cluster.getClusterScope())
                .createdAt(cluster.getCreatedAt())
                .updatedAt(cluster.getUpdatedAt())
                .build();
    }
}
