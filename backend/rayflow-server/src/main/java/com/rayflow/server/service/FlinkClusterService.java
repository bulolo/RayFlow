package com.rayflow.server.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.mapper.FlinkClusterMapper;
import com.rayflow.server.mapper.FlinkJobMapper;
import com.rayflow.server.model.entity.FlinkJob;
import com.rayflow.server.model.response.flink.FlinkClusterCheckResponse;
import com.rayflow.server.model.entity.FlinkCluster;
import com.rayflow.flink.client.FlinkRestClient;
import com.rayflow.flink.client.FlinkSqlGatewayClient;
import io.fabric8.kubernetes.client.Config;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Flink 运行时服务
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FlinkClusterService extends ServiceImpl<FlinkClusterMapper, FlinkCluster> {
    private static final String SCOPE_PLATFORM = "PLATFORM";
    private static final String SCOPE_TENANT = "TENANT";

    private final TenantAccessService tenantAccessService;
    private final FlinkJobMapper flinkJobMapper;

    @Value("${rayflow.flink.rest-connect-timeout-ms:3000}")
    private int connectTimeoutMs;

    @Value("${rayflow.flink.rest-read-timeout-ms:120000}")
    private int readTimeoutMs;

    public List<FlinkCluster> listCurrentTenantClusters() {
        return buildAccessibleClusterQuery()
                .list();
    }

    public IPage<FlinkCluster> pageCurrentTenantClusters(Page<FlinkCluster> page) {
        return buildAccessibleClusterQuery()
                .page(page);
    }

    private com.baomidou.mybatisplus.extension.conditions.query.LambdaQueryChainWrapper<FlinkCluster> buildAccessibleClusterQuery() {
        return lambdaQuery()
                .and(wrapper -> wrapper
                        .eq(FlinkCluster::getTenantId, tenantAccessService.requireCurrentTenantId())
                        .or()
                        .eq(FlinkCluster::getClusterScope, SCOPE_PLATFORM))
                .orderByAsc(FlinkCluster::getClusterScope)
                .orderByDesc(FlinkCluster::getId);
    }

    public FlinkCluster getRequired(Long id) {
        FlinkCluster cluster = lambdaQuery()
                .eq(FlinkCluster::getId, id)
                .and(wrapper -> wrapper
                        .eq(FlinkCluster::getTenantId, tenantAccessService.requireCurrentTenantId())
                        .or()
                        .eq(FlinkCluster::getClusterScope, SCOPE_PLATFORM))
                .last("LIMIT 1")
                .one();
        if (cluster == null) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
        return cluster;
    }

    public FlinkCluster getRequiredForTenant(Long id, Long tenantId) {
        FlinkCluster cluster = lambdaQuery()
                .eq(FlinkCluster::getId, id)
                .and(wrapper -> wrapper
                        .eq(FlinkCluster::getTenantId, tenantId)
                        .or()
                        .eq(FlinkCluster::getClusterScope, SCOPE_PLATFORM))
                .last("LIMIT 1")
                .one();
        if (cluster == null) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
        return cluster;
    }

    public FlinkCluster getRequiredByName(String clusterName) {
        FlinkCluster cluster = lambdaQuery()
                .eq(FlinkCluster::getClusterName, clusterName)
                .eq(FlinkCluster::getTenantId, tenantAccessService.requireCurrentTenantId())
                .last("LIMIT 1")
                .one();
        if (cluster == null) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "未找到集群: " + clusterName);
        }
        return cluster;
    }

    public FlinkCluster getRequiredGlobalByName(String clusterName) {
        FlinkCluster cluster = lambdaQuery()
                .eq(FlinkCluster::getClusterName, clusterName)
                .eq(FlinkCluster::getClusterScope, SCOPE_PLATFORM)
                .orderByAsc(FlinkCluster::getId)
                .last("LIMIT 1")
                .one();
        if (cluster == null) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "未找到平台内置运行时: " + clusterName);
        }
        return cluster;
    }

    public void createCluster(FlinkCluster cluster) {
        normalizeRuntimeFields(cluster);
        validateRuntimeFields(cluster);
        cluster.setTenantId(tenantAccessService.requireCurrentTenantId());
        cluster.setClusterScope(SCOPE_TENANT);
        cluster.setGatewayStatus(resolveGatewayStatus(cluster.getGatewayAddress()));
        save(cluster);
    }

    public void updateCluster(Long id, FlinkCluster cluster) {
        FlinkCluster existing = getRequired(id);
        ensureTenantManaged(existing);
        cluster.setId(existing.getId());
        cluster.setTenantId(existing.getTenantId());
        cluster.setClusterScope(existing.getClusterScope());
        normalizeRuntimeFields(cluster);
        validateRuntimeFields(cluster);
        boolean isK8sApp = "kubernetes".equalsIgnoreCase(cluster.getClusterType())
                && "application".equalsIgnoreCase(cluster.getDeploymentMode());
        if (isK8sApp) {
            // K8s Application: no REST address to probe; track image changes instead
            cluster.setStatus(existing.getStatus());
            if (sameValue(existing.getImage(), cluster.getImage())) {
                // Image unchanged: keep existing version
                cluster.setFlinkVersion(existing.getFlinkVersion());
            } else {
                // Image changed: extract new version from the tag
                cluster.setFlinkVersion(extractVersionFromImage(cluster.getImage()));
            }
        } else if (!sameValue(existing.getAddress(), cluster.getAddress())) {
            cluster.setStatus("UNREACHABLE");
            cluster.setFlinkVersion(null);
        } else {
            cluster.setStatus(existing.getStatus());
            cluster.setFlinkVersion(existing.getFlinkVersion());
        }
        if (!sameValue(existing.getGatewayAddress(), cluster.getGatewayAddress())) {
            cluster.setGatewayStatus(resolveGatewayStatus(cluster.getGatewayAddress()));
        } else {
            cluster.setGatewayStatus(existing.getGatewayStatus());
        }
        updateById(cluster);
    }

    public void deleteCluster(Long id) {
        FlinkCluster cluster = getRequired(id);
        ensureTenantManaged(cluster);
        long jobCount = flinkJobMapper.selectCount(com.baomidou.mybatisplus.core.toolkit.Wrappers
                .lambdaQuery(FlinkJob.class)
                .eq(FlinkJob::getClusterId, cluster.getId())
                .eq(FlinkJob::getTenantId, tenantAccessService.requireCurrentTenantId()));
        if (jobCount > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "运行时已被作业引用，不能删除");
        }
        removeById(id);
    }

    /**
     * 检查集群连通性
     */
    public FlinkClusterCheckResponse checkCluster(Long id) {
        FlinkCluster cluster = getRequired(id);
        if ("kubernetes".equalsIgnoreCase(cluster.getClusterType()) && "application".equalsIgnoreCase(cluster.getDeploymentMode())) {
            log.info("K8s Application cluster check: id={}, namespace={}", id, cluster.getNamespaceName());
            boolean k8sHealthy = probeKubernetesConnectivity(cluster.getKubeConfigRef(), cluster.getNamespaceName());
            cluster.setStatus(k8sHealthy ? "RUNNING" : "UNREACHABLE");
            cluster.setGatewayStatus("NOT_CONFIGURED");
            updateById(cluster);
            return new FlinkClusterCheckResponse(k8sHealthy, cluster.getStatus(), cluster.getGatewayStatus(), cluster.getFlinkVersion());
        }
        log.info("Cluster check: id={}, address={}", id, cluster.getAddress());
        boolean healthy;
        try {
            FlinkRestClient.ClusterProbeResult probeResult =
                    new FlinkRestClient(cluster.getAddress(), connectTimeoutMs, readTimeoutMs).probeCluster();
            healthy = probeResult.isHealthy();
            cluster.setFlinkVersion(probeResult.getFlinkVersion());
            if (healthy && !isSupportedFlinkVersion(probeResult.getFlinkVersion())) {
                healthy = false;
                log.warn(
                        "Unsupported Flink cluster version: id={}, address={}, version={}",
                        id,
                        cluster.getAddress(),
                        probeResult.getFlinkVersion()
                );
            }
        } catch (Exception e) {
            healthy = false;
            cluster.setFlinkVersion(null);
            log.warn("Cluster check failed: id={}, address={}, error={}", id, cluster.getAddress(), e.getMessage());
        }
        String gatewayStatus = probeGatewayStatus(cluster);
        String clusterStatus = healthy ? "RUNNING" : "UNREACHABLE";
        cluster.setGatewayStatus(gatewayStatus);
        cluster.setStatus(clusterStatus);
        updateById(cluster);
        return new FlinkClusterCheckResponse(healthy, clusterStatus, gatewayStatus, cluster.getFlinkVersion());
    }

    public void ensureSupportedFlink2Cluster(FlinkCluster cluster) {
        if ("kubernetes".equalsIgnoreCase(cluster.getClusterType()) && "application".equalsIgnoreCase(cluster.getDeploymentMode())) {
            String flinkVersion = cluster.getFlinkVersion();
            if (flinkVersion == null || flinkVersion.isBlank()) {
                flinkVersion = extractVersionFromImage(cluster.getImage());
                cluster.setFlinkVersion(flinkVersion);
                updateById(cluster);
            }
            if (!isSupportedFlinkVersion(flinkVersion)) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "RayFlow 当前仅支持 Flink 2.x 运行时，当前运行时版本: " + (flinkVersion == null ? "未知" : flinkVersion));
            }
            return;
        }
        String flinkVersion = cluster.getFlinkVersion();
        if (flinkVersion == null || flinkVersion.isBlank()) {
            try {
                FlinkRestClient.ClusterProbeResult probeResult =
                        new FlinkRestClient(cluster.getAddress(), connectTimeoutMs, readTimeoutMs).probeCluster();
                flinkVersion = probeResult.getFlinkVersion();
                cluster.setFlinkVersion(flinkVersion);
                cluster.setStatus(probeResult.isHealthy() ? "RUNNING" : "UNREACHABLE");
                updateById(cluster);
                if (!probeResult.isHealthy()) {
                    throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Flink 运行时连接失败，请先测试连接");
                }
            } catch (Exception e) {
                if (e instanceof BusinessException businessException) {
                    throw businessException;
                }
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Flink 运行时版本探测失败，请先测试连接");
            }
        }
        if (!isSupportedFlinkVersion(flinkVersion)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "RayFlow 当前仅支持 Flink 2.x 运行时，当前运行时版本: " + (flinkVersion == null ? "未知" : flinkVersion));
        }
    }

    private String probeGatewayStatus(FlinkCluster cluster) {
        if (cluster.getGatewayAddress() == null || cluster.getGatewayAddress().isBlank()) {
            return "NOT_CONFIGURED";
        }
        try {
            boolean healthy = new FlinkSqlGatewayClient(cluster.getGatewayAddress(), connectTimeoutMs, readTimeoutMs).isHealthy();
            return healthy ? "RUNNING" : "UNREACHABLE";
        } catch (Exception e) {
            log.warn("SQL Gateway check failed: id={}, address={}, error={}", cluster.getId(), cluster.getGatewayAddress(), e.getMessage());
            return "UNREACHABLE";
        }
    }

    private static String resolveGatewayStatus(String gatewayAddress) {
        return gatewayAddress == null || gatewayAddress.isBlank() ? "NOT_CONFIGURED" : "UNREACHABLE";
    }

    private static boolean isSupportedFlinkVersion(String flinkVersion) {
        return flinkVersion != null && flinkVersion.trim().startsWith("2.");
    }

    private static void normalizeRuntimeFields(FlinkCluster cluster) {
        if (cluster.getClusterType() == null || cluster.getClusterType().isBlank()) {
            cluster.setClusterType("standalone");
        }
        if ("kubernetes".equalsIgnoreCase(cluster.getClusterType())) {
            cluster.setDeploymentMode("application");
            if (cluster.getServiceExposureType() == null || cluster.getServiceExposureType().isBlank()) {
                cluster.setServiceExposureType("CLUSTER_IP");
            }
            cluster.setAddress(null);
            cluster.setGatewayAddress(null);
            cluster.setGatewayStatus("NOT_CONFIGURED");
            if (cluster.getFlinkVersion() == null || cluster.getFlinkVersion().isBlank()) {
                cluster.setFlinkVersion(extractVersionFromImage(cluster.getImage()));
            }
        } else {
            cluster.setClusterType("standalone");
            cluster.setDeploymentMode("session");
            cluster.setNamespaceName(null);
            cluster.setServiceAccount(null);
            cluster.setServiceExposureType(null);
            cluster.setKubeConfigRef(null);
            cluster.setPodTemplate(null);
        }
        if (cluster.getImagePullPolicy() == null || cluster.getImagePullPolicy().isBlank()) {
            cluster.setImagePullPolicy("IfNotPresent");
        }
    }

    /**
     * 从镜像名称的 tag 段提取版本号（如 flink:2.2.1 → "2.2.1"）。
     * 若无法提取则返回默认值 "2.2.1"。
     */
    private static String extractVersionFromImage(String image) {
        if (image != null && !image.isBlank()) {
            String trimmed = image.trim();
            int colonIndex = trimmed.lastIndexOf(':');
            if (colonIndex != -1 && colonIndex < trimmed.length() - 1) {
                String tag = trimmed.substring(colonIndex + 1);
                java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("^\\d+\\.\\d+(\\.\\d+)?").matcher(tag);
                if (matcher.find()) {
                    return matcher.group();
                }
            }
        }
        return "2.2.1";
    }

    private static void validateRuntimeFields(FlinkCluster cluster) {
        if ("kubernetes".equalsIgnoreCase(cluster.getClusterType())) {
            String exposureType = cluster.getServiceExposureType();
            if (!"CLUSTER_IP".equalsIgnoreCase(exposureType)
                    && !"NODE_PORT".equalsIgnoreCase(exposureType)
                    && !"LOAD_BALANCER".equalsIgnoreCase(exposureType)) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "K8s Application 服务对外类型仅支持 ClusterIP、NodePort、LoadBalancer");
            }
            return;
        }
        if (cluster.getAddress() == null || cluster.getAddress().isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Standalone 运行时必须填写 REST 地址");
        }
    }

    private void ensureTenantManaged(FlinkCluster cluster) {
        if (SCOPE_PLATFORM.equalsIgnoreCase(cluster.getClusterScope())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "平台内置运行时不允许在租户侧修改");
        }
    }

    private static boolean sameValue(String left, String right) {
        String normalizedLeft = left == null ? "" : left.trim();
        String normalizedRight = right == null ? "" : right.trim();
        return normalizedLeft.equals(normalizedRight);
    }

    /**
     * 探测 Kubernetes 配置连通性。
     * <ul>
     *   <li>kubeConfigRef 为空时使用容器内置 /root/.kube/config（AutoConfigure）。</li>
     *   <li>kubeConfigRef 包含 apiVersion 关键字时视为内联 Kubeconfig YAML 文本。</li>
     *   <li>其余情况视为容器内文件路径，读取后解析。</li>
     * </ul>
     * 通过向目标 Namespace（或 default）发送一次轻量 GET 请求来验证凭证与网络可达性。
     */
    private boolean probeKubernetesConnectivity(String kubeConfigRef, String namespace) {
        try {
            Config config;
            if (kubeConfigRef == null || kubeConfigRef.isBlank()) {
                config = Config.autoConfigure(null);
            } else if (kubeConfigRef.contains("apiVersion:") && kubeConfigRef.contains("clusters:")) {
                config = Config.fromKubeconfig(kubeConfigRef);
            } else {
                String content = java.nio.file.Files.readString(java.nio.file.Paths.get(kubeConfigRef.trim()));
                config = Config.fromKubeconfig(content);
            }
            config.setConnectionTimeout(5000);
            config.setRequestTimeout(5000);
            try (KubernetesClient client = new KubernetesClientBuilder().withConfig(config).build()) {
                String targetNamespace = (namespace == null || namespace.isBlank()) ? "default" : namespace.trim();
                client.namespaces().withName(targetNamespace).get();
                log.info("Kubernetes connectivity OK: namespace={}", targetNamespace);
                return true;
            }
        } catch (Exception e) {
            log.warn("Kubernetes connectivity check failed: {}", e.getMessage());
            return false;
        }
    }
}
