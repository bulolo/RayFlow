package com.rayflow.server.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.rayflow.server.mapper.FlinkJobExecutionMapper;
import com.rayflow.server.model.entity.FlinkJobExecution;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@Slf4j
@Service
public class FlinkJobExecutionService extends ServiceImpl<FlinkJobExecutionMapper, FlinkJobExecution> {

    public FlinkJobExecution createSubmitting(Long jobId, Long versionId, String versionName, Long tenantId, Long createdBy) {
        FlinkJobExecution execution = new FlinkJobExecution();
        execution.setJobId(jobId);
        execution.setVersionId(versionId);
        execution.setVersionName(versionName);
        execution.setTenantId(tenantId);
        execution.setCreatedBy(createdBy);
        execution.setStatus("SUBMITTING");
        execution.setStartTime(LocalDateTime.now());
        this.save(execution);
        return execution;
    }

    public void markRunning(FlinkJobExecution execution, String flinkJobId) {
        if (execution == null) {
            return;
        }
        execution.setFlinkJobId(flinkJobId);
        execution.setStatus("RUNNING");
        this.updateById(execution);
    }

    public void attachSubmitPayload(FlinkJobExecution execution, String submitPayload) {
        if (execution == null || !StringUtils.hasText(submitPayload)) {
            return;
        }
        execution.setSubmitPayload(submitPayload);
        this.updateById(execution);
    }

    public void markFailed(FlinkJobExecution execution, String errorLog) {
        if (execution == null) {
            return;
        }
        execution.setStatus("FAILED");
        execution.setErrorLog(errorLog);
        finish(execution);
    }

    public void syncStatus(Long executionId, String status, String errorLog) {
        if (executionId == null || !StringUtils.hasText(status)) {
            return;
        }
        FlinkJobExecution execution = getById(executionId);
        if (execution == null) {
            return;
        }
        boolean sameStatus = status.equalsIgnoreCase(execution.getStatus());
        boolean sameErrorLog = !StringUtils.hasText(errorLog) || Objects.equals(errorLog, execution.getErrorLog());
        if (sameStatus && sameErrorLog && (!isTerminal(status) || execution.getEndTime() != null)) {
            return;
        }
        execution.setStatus(status);
        if (StringUtils.hasText(errorLog)) {
            execution.setErrorLog(errorLog);
        }
        if (isTerminal(status)) {
            finish(execution);
            return;
        }
        this.updateById(execution);
    }

    public void syncCanceled(Long executionId) {
        syncStatus(executionId, "CANCELED", null);
    }

    public List<FlinkJobExecution> listByJob(Long jobId, Long tenantId, int limit) {
        return this.list(new LambdaQueryWrapper<FlinkJobExecution>()
                .eq(FlinkJobExecution::getJobId, jobId)
                .eq(FlinkJobExecution::getTenantId, tenantId)
                .orderByDesc(FlinkJobExecution::getId)
                .last("LIMIT " + Math.max(1, limit)));
    }

    public void pruneByJob(Long jobId, Long tenantId, int retention) {
        List<Long> retainedIds = listByJob(jobId, tenantId, retention).stream()
                .map(FlinkJobExecution::getId)
                .toList();
        LambdaQueryWrapper<FlinkJobExecution> query = new LambdaQueryWrapper<FlinkJobExecution>()
                .eq(FlinkJobExecution::getJobId, jobId)
                .eq(FlinkJobExecution::getTenantId, tenantId);
        if (!retainedIds.isEmpty()) {
            query.notIn(FlinkJobExecution::getId, retainedIds);
        }
        this.remove(query);
    }

    private void finish(FlinkJobExecution execution) {
        if (execution.getEndTime() == null) {
            execution.setEndTime(LocalDateTime.now());
        }
        if (execution.getStartTime() != null) {
            execution.setDuration(Duration.between(execution.getStartTime(), execution.getEndTime()).toMillis());
        }
        this.updateById(execution);
    }

    private static boolean isTerminal(String status) {
        return "FINISHED".equalsIgnoreCase(status)
                || "FAILED".equalsIgnoreCase(status)
                || "CANCELED".equalsIgnoreCase(status)
                || "SUSPENDED".equalsIgnoreCase(status);
    }
}
