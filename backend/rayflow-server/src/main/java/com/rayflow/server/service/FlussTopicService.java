package com.rayflow.server.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.mapper.FlussTopicMapper;
import com.rayflow.server.model.entity.FlussCluster;
import com.rayflow.server.model.entity.FlussTopic;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Fluss Topic 服务
 */
@Service
@RequiredArgsConstructor
public class FlussTopicService extends ServiceImpl<FlussTopicMapper, FlussTopic> {

    private final TenantAccessService tenantAccessService;
    private final FlussClusterService flussClusterService;

    public List<FlussTopic> listTopics(Long clusterId) {
        return buildTopicQuery(clusterId)
                .list();
    }

    public IPage<FlussTopic> pageTopics(Long clusterId, Page<FlussTopic> page) {
        return buildTopicQuery(clusterId)
                .page(page);
    }

    private com.baomidou.mybatisplus.extension.conditions.query.LambdaQueryChainWrapper<FlussTopic> buildTopicQuery(Long clusterId) {
        Long tenantId = tenantAccessService.requireCurrentTenantId();
        if (clusterId != null) {
            FlussCluster cluster = flussClusterService.getRequired(clusterId);
            return lambdaQuery()
                    .eq(FlussTopic::getTenantId, tenantId)
                    .eq(FlussTopic::getClusterId, cluster.getId())
                    .orderByDesc(FlussTopic::getId);
        }
        return lambdaQuery()
                .eq(FlussTopic::getTenantId, tenantId)
                .orderByDesc(FlussTopic::getId);
    }

    public FlussTopic getRequired(Long id) {
        FlussTopic topic = lambdaQuery()
                .eq(FlussTopic::getId, id)
                .eq(FlussTopic::getTenantId, tenantAccessService.requireCurrentTenantId())
                .last("LIMIT 1")
                .one();
        if (topic == null) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
        return topic;
    }

    public void createTopic(FlussTopic topic) {
        FlussCluster cluster = flussClusterService.getRequired(topic.getClusterId());
        topic.setClusterId(cluster.getId());
        topic.setTenantId(tenantAccessService.requireCurrentTenantId());
        save(topic);
    }

    public void updateTopic(Long id, FlussTopic topic) {
        FlussTopic existing = getRequired(id);
        FlussCluster cluster = flussClusterService.getRequired(topic.getClusterId());
        topic.setId(existing.getId());
        topic.setClusterId(cluster.getId());
        topic.setTenantId(existing.getTenantId());
        updateById(topic);
    }

    public void deleteTopic(Long id) {
        getRequired(id);
        removeById(id);
    }
}
