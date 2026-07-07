package com.rayflow.server.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.mapper.FlussClusterMapper;
import com.rayflow.server.mapper.FlussTopicMapper;
import com.rayflow.server.model.entity.FlussCluster;
import com.rayflow.server.model.entity.FlussTopic;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.List;

/**
 * Fluss 集群服务
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FlussClusterService extends ServiceImpl<FlussClusterMapper, FlussCluster> {

    private final TenantAccessService tenantAccessService;
    private final FlussTopicMapper flussTopicMapper;

    public List<FlussCluster> listCurrentTenantClusters() {
        return buildTenantClusterQuery()
                .list();
    }

    public IPage<FlussCluster> pageCurrentTenantClusters(Page<FlussCluster> page) {
        return buildTenantClusterQuery()
                .page(page);
    }

    public void deleteCluster(Long id) {
        FlussCluster cluster = getRequired(id);
        long topicCount = flussTopicMapper.selectCount(com.baomidou.mybatisplus.core.toolkit.Wrappers
                .lambdaQuery(FlussTopic.class)
                .eq(FlussTopic::getClusterId, cluster.getId())
                .eq(FlussTopic::getTenantId, tenantAccessService.requireCurrentTenantId()));
        if (topicCount > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Fluss 集群已被 Topic 引用，不能删除");
        }
        removeById(id);
    }

    private com.baomidou.mybatisplus.extension.conditions.query.LambdaQueryChainWrapper<FlussCluster> buildTenantClusterQuery() {
        return lambdaQuery()
                .eq(FlussCluster::getTenantId, tenantAccessService.requireCurrentTenantId())
                .orderByDesc(FlussCluster::getId);
    }

    public FlussCluster getRequired(Long id) {
        FlussCluster cluster = lambdaQuery()
                .eq(FlussCluster::getId, id)
                .eq(FlussCluster::getTenantId, tenantAccessService.requireCurrentTenantId())
                .last("LIMIT 1")
                .one();
        if (cluster == null) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
        return cluster;
    }

    public void createCluster(FlussCluster cluster) {
        validateCluster(cluster, null);
        cluster.setTenantId(tenantAccessService.requireCurrentTenantId());
        save(cluster);
    }

    public void updateCluster(Long id, FlussCluster cluster) {
        FlussCluster existing = getRequired(id);
        cluster.setId(existing.getId());
        cluster.setTenantId(existing.getTenantId());
        validateCluster(cluster, id);
        updateById(cluster);
    }

    public boolean checkCluster(Long id) {
        FlussCluster cluster = getRequired(id);
        String servers = cluster.getBootstrapServers();
        boolean ok = true;
        if (servers == null || servers.isBlank()) {
            ok = false;
        } else {
            for (String server : servers.split(",")) {
                String trimmedServer = server.trim();
                if (trimmedServer.isBlank()) {
                    ok = false;
                    break;
                }
                String[] parts = trimmedServer.split(":");
                String host = parts[0].trim();
                int port = 9123;
                if (host.isBlank() || parts.length > 2) {
                    ok = false;
                    break;
                }
                if (parts.length == 2) {
                    try {
                        port = Integer.parseInt(parts[1].trim());
                    } catch (NumberFormatException e) {
                        ok = false;
                        break;
                    }
                }
                if (!checkServer(host, port)) {
                    ok = false;
                    break;
                }
            }
        }
        String nextStatus = ok ? "ACTIVE" : "UNREACHABLE";
        if (!nextStatus.equals(cluster.getStatus())) {
            cluster.setStatus(nextStatus);
            updateById(cluster);
        }
        return ok;
    }

    private boolean checkServer(String host, int port) {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), 2000);
            return true;
        } catch (Exception e) {
            log.warn("Failed to connect to Fluss cluster: {}:{}", host, port, e);
            return false;
        }
    }

    private void validateCluster(FlussCluster cluster, Long currentId) {
        Long duplicateCount = lambdaQuery()
                .eq(FlussCluster::getTenantId, tenantAccessService.requireCurrentTenantId())
                .eq(FlussCluster::getClusterName, cluster.getClusterName())
                .ne(currentId != null, FlussCluster::getId, currentId)
                .count();
        if (duplicateCount > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Fluss 集群名称已存在");
        }
    }
}
