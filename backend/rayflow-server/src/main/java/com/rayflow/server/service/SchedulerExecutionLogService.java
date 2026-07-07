package com.rayflow.server.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.rayflow.server.mapper.SchedulerExecutionLogMapper;
import com.rayflow.server.model.entity.SchedulerExecution;
import com.rayflow.server.model.entity.SchedulerExecutionLog;
import com.rayflow.server.model.entity.SchedulerNodeExecution;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SchedulerExecutionLogService {

    private final SchedulerExecutionLogMapper executionLogMapper;

    public void appendExecutionLog(SchedulerExecution execution, String level, String eventType, String message) {
        SchedulerExecutionLog log = new SchedulerExecutionLog();
        log.setExecutionId(execution.getId());
        log.setWorkflowId(execution.getWorkflowId());
        log.setLevel(level);
        log.setEventType(eventType);
        log.setMessage(message);
        log.setTenantId(execution.getTenantId());
        executionLogMapper.insert(log);
    }

    public void appendNodeExecutionLog(SchedulerExecution execution, SchedulerNodeExecution nodeExecution, String level, String eventType, String message) {
        SchedulerExecutionLog log = new SchedulerExecutionLog();
        log.setExecutionId(nodeExecution.getExecutionId());
        log.setWorkflowId(nodeExecution.getWorkflowId());
        log.setNodeExecutionId(nodeExecution.getId());
        log.setNodeKey(nodeExecution.getNodeKey());
        log.setLevel(level);
        log.setEventType(eventType);
        log.setMessage(message);
        log.setTenantId(execution == null ? nodeExecution.getTenantId() : execution.getTenantId());
        executionLogMapper.insert(log);
    }

    public List<SchedulerExecutionLog> listExecutionLogs(Long executionId, Long tenantId) {
        return executionLogMapper.selectList(new LambdaQueryWrapper<SchedulerExecutionLog>()
                .eq(SchedulerExecutionLog::getExecutionId, executionId)
                .eq(SchedulerExecutionLog::getTenantId, tenantId)
                .orderByAsc(SchedulerExecutionLog::getId));
    }

    public void deleteByWorkflow(Long workflowId, Long tenantId) {
        executionLogMapper.delete(new LambdaQueryWrapper<SchedulerExecutionLog>()
                .eq(SchedulerExecutionLog::getWorkflowId, workflowId)
                .eq(SchedulerExecutionLog::getTenantId, tenantId));
    }
}
