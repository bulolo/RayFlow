package com.rayflow.server.service;

import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.flink.client.FlinkRestClient;
import com.rayflow.server.mapper.FlinkSavepointMapper;
import com.rayflow.server.model.entity.FlinkCluster;
import com.rayflow.server.model.entity.FlinkJob;
import com.rayflow.server.model.entity.FlinkSavepoint;
import com.rayflow.server.model.response.flink.FlinkCheckpointResponse;
import com.rayflow.server.model.response.flink.FlinkSavepointRecordResponse;
import com.rayflow.server.model.response.flink.FlinkSavepointResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Flink Savepoint 服务
 */
@Service
@RequiredArgsConstructor
public class FlinkSavepointService {

    private final FlinkJobService flinkJobService;
    private final FlinkClusterService flinkClusterService;
    private final FlinkSavepointMapper flinkSavepointMapper;
    private final SystemDefaultsService systemDefaultsService;

    @Value("${rayflow.flink.rest-connect-timeout-ms:3000}")
    private int connectTimeoutMs;

    @Value("${rayflow.flink.rest-read-timeout-ms:120000}")
    private int readTimeoutMs;

    public FlinkSavepointResponse trigger(Long jobId, String targetDirectory, boolean cancelJob) {
        FlinkJob job = flinkJobService.getRequired(jobId);
        if (job.getFlinkJobId() == null || job.getFlinkJobId().isBlank()) {
            throw new BusinessException(ResultCode.FLINK_SAVEPOINT_FAILED);
        }
        FlinkCluster cluster = flinkClusterService.getRequired(job.getClusterId());
        Map<String, Object> response = new FlinkRestClient(cluster.getAddress(), connectTimeoutMs, readTimeoutMs)
                .triggerSavepoint(job.getFlinkJobId(), targetDirectory, cancelJob);
        FlinkSavepoint savepoint = new FlinkSavepoint();
        savepoint.setJobId(job.getId());
        savepoint.setJobName(job.getJobName());
        savepoint.setFlinkJobId(job.getFlinkJobId());
        savepoint.setRequestId(readString(response, "request-id"));
        savepoint.setLocation(readString(response, "location"));
        savepoint.setTargetDirectory(targetDirectory);
        savepoint.setCancelJob(cancelJob);
        savepoint.setStatus("TRIGGERED");
        savepoint.setTriggerMessage(readString(response, "status"));
        savepoint.setTenantId(job.getTenantId());
        flinkSavepointMapper.insert(savepoint);
        if (savepoint.getLocation() != null && !savepoint.getLocation().isBlank()) {
            job.setSavepointPath(savepoint.getLocation());
            flinkJobService.updateById(job);
        }
        pruneByJob(job.getId(), job.getTenantId(), systemDefaultsService.savepointRetention(job.getTenantId()));
        return FlinkSavepointResponse.from(savepoint.getId(), job.getFlinkJobId(), targetDirectory, cancelJob, response);
    }

    public List<FlinkSavepointRecordResponse> listByJob(Long jobId) {
        FlinkJob job = flinkJobService.getRequired(jobId);
        int retention = systemDefaultsService.savepointRetention(job.getTenantId());
        return flinkSavepointMapper.selectList(com.baomidou.mybatisplus.core.toolkit.Wrappers.<FlinkSavepoint>lambdaQuery()
                        .eq(FlinkSavepoint::getJobId, job.getId())
                        .eq(FlinkSavepoint::getTenantId, job.getTenantId())
                        .orderByDesc(FlinkSavepoint::getId)
                        .last("LIMIT " + retention))
                .stream()
                .map(FlinkSavepointRecordResponse::from)
                .toList();
    }

    private void pruneByJob(Long jobId, Long tenantId, int retention) {
        List<Long> retainedIds = flinkSavepointMapper.selectList(com.baomidou.mybatisplus.core.toolkit.Wrappers.<FlinkSavepoint>lambdaQuery()
                        .select(FlinkSavepoint::getId)
                        .eq(FlinkSavepoint::getJobId, jobId)
                        .eq(FlinkSavepoint::getTenantId, tenantId)
                        .orderByDesc(FlinkSavepoint::getId)
                        .last("LIMIT " + Math.max(1, retention)))
                .stream()
                .map(FlinkSavepoint::getId)
                .toList();
        var query = com.baomidou.mybatisplus.core.toolkit.Wrappers.<FlinkSavepoint>lambdaQuery()
                .eq(FlinkSavepoint::getJobId, jobId)
                .eq(FlinkSavepoint::getTenantId, tenantId);
        if (!retainedIds.isEmpty()) {
            query.notIn(FlinkSavepoint::getId, retainedIds);
        }
        flinkSavepointMapper.delete(query);
    }

    public FlinkCheckpointResponse getCheckpoints(Long jobId) {
        FlinkJob job = flinkJobService.getRequired(jobId);
        if (job.getFlinkJobId() == null || job.getFlinkJobId().isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Flink Job ID 为空，无法查询 Checkpoint");
        }
        FlinkCluster cluster = flinkClusterService.getRequired(job.getClusterId());
        Map<String, Object> response = new FlinkRestClient(cluster.getAddress(), connectTimeoutMs, readTimeoutMs)
                .getJobCheckpoints(job.getFlinkJobId());
        return FlinkCheckpointResponse.from(job.getFlinkJobId(), response);
    }

    private static String readString(Map<String, Object> source, String key) {
        Object value = source == null ? null : source.get(key);
        return value == null ? null : String.valueOf(value);
    }
}
