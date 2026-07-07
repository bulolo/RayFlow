package com.rayflow.server.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.mapper.SchedulerExecutionMapper;
import com.rayflow.server.mapper.SchedulerNodeExecutionMapper;
import com.rayflow.server.mapper.SchedulerWorkflowEdgeMapper;
import com.rayflow.server.mapper.SchedulerWorkflowMapper;
import com.rayflow.server.mapper.SchedulerWorkflowNodeMapper;
import com.rayflow.server.mapper.SchedulerWorkflowVariableMapper;
import com.rayflow.server.mapper.SchedulerWorkflowVersionMapper;
import com.rayflow.server.model.entity.FlinkJob;
import com.rayflow.server.model.entity.SchedulerExecution;
import com.rayflow.server.model.entity.SchedulerExecutionLog;
import com.rayflow.server.model.entity.SchedulerNodeExecution;
import com.rayflow.server.model.entity.SchedulerWorkflow;
import com.rayflow.server.model.entity.SchedulerWorkflowEdge;
import com.rayflow.server.model.entity.SchedulerWorkflowNode;
import com.rayflow.server.model.entity.SchedulerWorkflowVariable;
import com.rayflow.server.model.entity.SchedulerWorkflowVersion;
import com.rayflow.server.model.request.scheduler.SchedulerDefinitionRequest;
import com.rayflow.server.model.request.scheduler.SchedulerEdgeRequest;
import com.rayflow.server.model.request.scheduler.SchedulerNodeRequest;
import com.rayflow.server.model.request.scheduler.SchedulerVariableRequest;
import com.rayflow.server.model.request.scheduler.SchedulerWorkflowRequest;
import com.rayflow.server.model.response.scheduler.SchedulerDefinitionResponse;
import com.rayflow.server.model.response.scheduler.SchedulerEdgeResponse;
import com.rayflow.server.model.response.scheduler.SchedulerExecutionResponse;
import com.rayflow.server.model.response.scheduler.SchedulerNodeResponse;
import com.rayflow.server.model.response.scheduler.SchedulerValidationResponse;
import com.rayflow.server.model.response.scheduler.SchedulerVariableResponse;
import com.rayflow.server.model.response.scheduler.SchedulerVersionResponse;
import com.rayflow.server.model.response.scheduler.SchedulerWorkflowResponse;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.Resource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;

import static com.rayflow.server.model.enums.SchedulerConstants.CONCURRENT_POLICY_SERIAL_RUNS;
import static com.rayflow.server.model.enums.SchedulerConstants.EDGE_STRATEGY_WAIT_SUCCESS;
import static com.rayflow.server.model.enums.SchedulerConstants.EXECUTION_MODE_TOPOLOGY;
import static com.rayflow.server.model.enums.SchedulerConstants.EXECUTION_STATUS_CANCELED;
import static com.rayflow.server.model.enums.SchedulerConstants.EXECUTION_STATUS_FAILED;
import static com.rayflow.server.model.enums.SchedulerConstants.EXECUTION_STATUS_PENDING;
import static com.rayflow.server.model.enums.SchedulerConstants.EXECUTION_STATUS_RETRYING;
import static com.rayflow.server.model.enums.SchedulerConstants.EXECUTION_STATUS_RUNNING;
import static com.rayflow.server.model.enums.SchedulerConstants.EXECUTION_STATUS_SKIPPED;
import static com.rayflow.server.model.enums.SchedulerConstants.EXECUTION_STATUS_SUCCESS;
import static com.rayflow.server.model.enums.SchedulerConstants.FAILURE_STRATEGY_BLOCK_ALL;
import static com.rayflow.server.model.enums.SchedulerConstants.TIMEOUT_POLICY_ALARM_ONLY;
import static com.rayflow.server.model.enums.SchedulerConstants.WORKFLOW_STATUS_PAUSED;

@Slf4j
@Service
@RequiredArgsConstructor
public class SchedulerWorkflowService extends ServiceImpl<SchedulerWorkflowMapper, SchedulerWorkflow> {

    private final TenantAccessService tenantAccessService;
    private final FlinkJobService flinkJobService;
    private final SchedulerWorkflowNodeMapper nodeMapper;
    private final SchedulerWorkflowEdgeMapper edgeMapper;
    private final SchedulerWorkflowVariableMapper variableMapper;
    private final SchedulerWorkflowVersionMapper versionMapper;
    private final SchedulerExecutionMapper executionMapper;
    private final SchedulerNodeExecutionMapper nodeExecutionMapper;
    private final SchedulerDefinitionValidator definitionValidator;
    private final SchedulerWorkflowRunner workflowRunner;
    private final SchedulerExecutionLogService executionLogService;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    @Value("${rayflow.timezone:UTC}")
    private String defaultTimezone;
    @Value("${rayflow.scheduler.instance-id:${HOSTNAME:local}}")
    private String schedulerInstanceId;
    @Resource(name = "schedulerTaskExecutor")
    private Executor schedulerExecutor;

    @PostConstruct
    public void recoverInterruptedExecutions() {
        List<SchedulerExecution> runningExecutions = executionMapper.selectList(new LambdaQueryWrapper<SchedulerExecution>()
                .eq(SchedulerExecution::getStatus, EXECUTION_STATUS_RUNNING)
                .eq(SchedulerExecution::getOwnerInstanceId, schedulerInstanceId));
        for (SchedulerExecution execution : runningExecutions) {
            execution.setStatus(EXECUTION_STATUS_FAILED);
            execution.setMessage("后端服务重启，运行实例已中断，请重新运行");
            execution.setFinishedAt(LocalDateTime.now());
            executionMapper.updateById(execution);
            executionLogService.appendExecutionLog(execution, "WARN", "RECOVER_INTERRUPTED", "后端服务重启，运行实例已标记为失败");

            List<SchedulerNodeExecution> activeNodes = nodeExecutionMapper.selectList(new LambdaQueryWrapper<SchedulerNodeExecution>()
                    .eq(SchedulerNodeExecution::getExecutionId, execution.getId())
                    .in(SchedulerNodeExecution::getStatus, EXECUTION_STATUS_PENDING, EXECUTION_STATUS_RUNNING, EXECUTION_STATUS_RETRYING));
            for (SchedulerNodeExecution nodeExecution : activeNodes) {
                nodeExecution.setStatus(EXECUTION_STATUS_SKIPPED);
                nodeExecution.setMessage("后端服务重启，节点未完成");
                nodeExecution.setFinishedAt(LocalDateTime.now());
                nodeExecutionMapper.updateById(nodeExecution);
                executionLogService.appendNodeExecutionLog(execution, nodeExecution, "WARN", "NODE_RECOVER_SKIPPED", "后端服务重启，节点未完成");
            }
        }
    }

    public IPage<SchedulerWorkflow> pageWorkflows(Page<SchedulerWorkflow> page, String keyword, String status) {
        String normalizedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        return lambdaQuery()
                .eq(SchedulerWorkflow::getTenantId, tenantAccessService.requireCurrentTenantId())
                .and(StringUtils.hasText(normalizedKeyword), wrapper -> wrapper
                        .like(SchedulerWorkflow::getWorkflowName, normalizedKeyword)
                        .or()
                        .like(SchedulerWorkflow::getDescription, normalizedKeyword)
                        .or()
                        .like(SchedulerWorkflow::getPeriod, normalizedKeyword)
                        .or()
                        .like(SchedulerWorkflow::getCron, normalizedKeyword))
                .eq(StringUtils.hasText(status), SchedulerWorkflow::getStatus, status)
                .orderByDesc(SchedulerWorkflow::getId)
                .page(page);
    }

    public List<SchedulerWorkflow> listWorkflows(String keyword, String status) {
        String normalizedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        return lambdaQuery()
                .eq(SchedulerWorkflow::getTenantId, tenantAccessService.requireCurrentTenantId())
                .and(StringUtils.hasText(normalizedKeyword), wrapper -> wrapper
                        .like(SchedulerWorkflow::getWorkflowName, normalizedKeyword)
                        .or()
                        .like(SchedulerWorkflow::getDescription, normalizedKeyword)
                        .or()
                        .like(SchedulerWorkflow::getPeriod, normalizedKeyword)
                        .or()
                        .like(SchedulerWorkflow::getCron, normalizedKeyword))
                .eq(StringUtils.hasText(status), SchedulerWorkflow::getStatus, status)
                .orderByDesc(SchedulerWorkflow::getId)
                .list();
    }

    public SchedulerWorkflowResponse toWorkflowResponse(SchedulerWorkflow workflow) {
        return SchedulerWorkflowResponse.from(
                workflow,
                countNodes(workflow.getId()),
                latestVersionName(workflow.getId()),
                latestExecutionStatus(workflow.getId())
        );
    }

    @Transactional
    public SchedulerWorkflowResponse createWorkflow(SchedulerWorkflowRequest request) {
        Long tenantId = tenantAccessService.requireCurrentTenantId();
        validateUniqueName(request.getWorkflowName(), tenantId, null);
        SchedulerWorkflow workflow = new SchedulerWorkflow();
        applyWorkflowRequest(workflow, request);
        workflow.setTenantId(tenantId);
        workflow.setCreatedBy(tenantAccessService.requireCurrentUser().getId());
        save(workflow);
        return toWorkflowResponse(workflow);
    }

    @Transactional
    public SchedulerWorkflowResponse updateWorkflow(Long id, SchedulerWorkflowRequest request) {
        SchedulerWorkflow workflow = getRequired(id);
        validateUniqueName(request.getWorkflowName(), workflow.getTenantId(), id);
        applyWorkflowRequest(workflow, request);
        updateById(workflow);
        return toWorkflowResponse(workflow);
    }

    @Transactional
    public void deleteWorkflow(Long id) {
        SchedulerWorkflow workflow = getRequired(id);
        assertNoRunningExecution(workflow);
        removeById(workflow.getId());
        deleteChildren(workflow);
    }

    public SchedulerWorkflow getRequired(Long id) {
        SchedulerWorkflow workflow = lambdaQuery()
                .eq(SchedulerWorkflow::getId, id)
                .eq(SchedulerWorkflow::getTenantId, tenantAccessService.requireCurrentTenantId())
                .last("LIMIT 1")
                .one();
        if (workflow == null) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
        return workflow;
    }

    public SchedulerDefinitionResponse getDefinition(Long workflowId) {
        SchedulerWorkflow workflow = getRequired(workflowId);
        return buildDefinitionResponse(workflow);
    }

    @Transactional
    public SchedulerDefinitionResponse updateDefinition(Long workflowId, SchedulerDefinitionRequest request) {
        SchedulerWorkflow workflow = getRequired(workflowId);
        assertNoRunningExecution(workflow, "工作流正在运行中，不能修改编排定义");
        SchedulerValidationResponse validation = validateDefinition(request);
        if (!Boolean.TRUE.equals(validation.getValid())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), String.join("; ", validation.getErrors()));
        }

        deleteDefinition(workflow);
        Long tenantId = workflow.getTenantId();
        for (SchedulerNodeRequest nodeRequest : safeNodes(request)) {
            FlinkJob job = flinkJobService.getRequired(nodeRequest.getFlinkJobId());
            SchedulerWorkflowNode node = new SchedulerWorkflowNode();
            node.setWorkflowId(workflow.getId());
            node.setNodeKey(nodeRequest.getNodeKey().trim());
            node.setFlinkJobId(job.getId());
            node.setJobName(job.getJobName());
            node.setJobType(job.getJobType());
            node.setMaxRetries(defaultInt(nodeRequest.getMaxRetries(), 0));
            node.setRetryInterval(defaultInt(nodeRequest.getRetryInterval(), 60));
            node.setTimeoutMinutes(defaultInt(nodeRequest.getTimeoutMinutes(), 0));
            node.setOnTimeout(defaultString(nodeRequest.getOnTimeout(), TIMEOUT_POLICY_ALARM_ONLY));
            node.setPositionX(defaultInt(nodeRequest.getPositionX(), 40));
            node.setPositionY(defaultInt(nodeRequest.getPositionY(), 80));
            node.setTenantId(tenantId);
            nodeMapper.insert(node);
        }
        for (SchedulerEdgeRequest edgeRequest : safeEdges(request)) {
            SchedulerWorkflowEdge edge = new SchedulerWorkflowEdge();
            edge.setWorkflowId(workflow.getId());
            edge.setFromNodeKey(edgeRequest.getFromNodeKey().trim());
            edge.setToNodeKey(edgeRequest.getToNodeKey().trim());
            edge.setStrategy(defaultString(edgeRequest.getStrategy(), EDGE_STRATEGY_WAIT_SUCCESS));
            edge.setTenantId(tenantId);
            edgeMapper.insert(edge);
        }
        for (SchedulerVariableRequest variableRequest : safeVariables(request)) {
            SchedulerWorkflowVariable variable = new SchedulerWorkflowVariable();
            variable.setWorkflowId(workflow.getId());
            variable.setVariableKey(variableRequest.getVariableKey().trim());
            variable.setVariableValue(variableRequest.getVariableValue());
            variable.setTenantId(tenantId);
            variableMapper.insert(variable);
        }
        return buildDefinitionResponse(workflow);
    }

    public SchedulerValidationResponse validateCurrentDefinition(Long workflowId) {
        getRequired(workflowId);
        SchedulerDefinitionRequest request = new SchedulerDefinitionRequest();
        request.setNodes(listNodes(workflowId).stream().map(this::toNodeRequest).toList());
        request.setEdges(listEdges(workflowId).stream().map(this::toEdgeRequest).toList());
        request.setVariables(listVariables(workflowId).stream().map(this::toVariableRequest).toList());
        return validateDefinition(request);
    }

    public SchedulerValidationResponse validateDefinition(SchedulerDefinitionRequest request) {
        return definitionValidator.validate(request);
    }

    @Transactional
    public SchedulerVersionResponse publishVersion(Long workflowId, String remark) {
        SchedulerWorkflow workflow = getRequired(workflowId);
        SchedulerValidationResponse validation = validateCurrentDefinition(workflowId);
        if (!Boolean.TRUE.equals(validation.getValid()) || countNodes(workflowId) == 0) {
            List<String> errors = new ArrayList<>(validation.getErrors());
            if (countNodes(workflowId) == 0) {
                errors.add("工作流没有节点，不能发布版本");
            }
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), String.join("; ", errors));
        }

        Integer nextVersionNo = nextVersionNo(workflowId);
        SchedulerWorkflowVersion version = new SchedulerWorkflowVersion();
        version.setWorkflowId(workflowId);
        version.setVersionNo(nextVersionNo);
        version.setVersionName("V" + nextVersionNo);
        version.setSnapshotJson(writeSnapshot(buildDefinitionResponse(workflow)));
        version.setRemark(StringUtils.hasText(remark) ? remark.trim() : "发布工作流版本 " + version.getVersionName());
        version.setTenantId(workflow.getTenantId());
        version.setCreatedBy(tenantAccessService.requireCurrentUser().getId());
        versionMapper.insert(version);
        return SchedulerVersionResponse.from(version);
    }

    public List<SchedulerVersionResponse> listVersions(Long workflowId) {
        getRequired(workflowId);
        return versionMapper.selectList(new LambdaQueryWrapper<SchedulerWorkflowVersion>()
                        .eq(SchedulerWorkflowVersion::getWorkflowId, workflowId)
                        .eq(SchedulerWorkflowVersion::getTenantId, tenantAccessService.requireCurrentTenantId())
                        .orderByDesc(SchedulerWorkflowVersion::getVersionNo))
                .stream()
                .map(SchedulerVersionResponse::from)
                .toList();
    }

    @Transactional
    public SchedulerExecutionResponse runWorkflow(Long workflowId) {
        SchedulerWorkflow workflow = getRequired(workflowId);
        lockWorkflowRunCreation(workflow);
        SchedulerValidationResponse validation = validateCurrentDefinition(workflowId);
        if (!Boolean.TRUE.equals(validation.getValid()) || countNodes(workflowId) == 0) {
            List<String> errors = new ArrayList<>(validation.getErrors());
            if (countNodes(workflowId) == 0) {
                errors.add("工作流没有节点，不能运行");
            }
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), String.join("; ", errors));
        }

        List<SchedulerWorkflowNode> nodes = listNodes(workflowId);
        List<SchedulerWorkflowEdge> edges = listEdges(workflowId);
        assertConcurrentPolicy(workflow);
        SchedulerWorkflowVersion latestVersion = latestVersion(workflowId);
        SchedulerExecution execution = new SchedulerExecution();
        execution.setWorkflowId(workflowId);
        execution.setVersionId(latestVersion == null ? null : latestVersion.getId());
        execution.setTriggerType("MANUAL");
        execution.setStatus(EXECUTION_STATUS_RUNNING);
        execution.setMessage("调度运行实例已创建，开始按 DAG 拓扑执行 Flink 作业");
        execution.setStartedAt(LocalDateTime.now());
        execution.setOwnerInstanceId(schedulerInstanceId);
        execution.setHeartbeatAt(execution.getStartedAt());
        execution.setTenantId(workflow.getTenantId());
        execution.setCreatedBy(tenantAccessService.requireCurrentUser().getId());
        executionMapper.insert(execution);
        executionLogService.appendExecutionLog(execution, "INFO", "EXECUTION_CREATED", "调度运行实例已创建，开始按 DAG 拓扑执行 Flink 作业");

        Map<String, SchedulerNodeExecution> nodeExecutions = new HashMap<>();
        for (SchedulerWorkflowNode node : nodes) {
            SchedulerNodeExecution nodeExecution = new SchedulerNodeExecution();
            nodeExecution.setExecutionId(execution.getId());
            nodeExecution.setWorkflowId(workflowId);
            nodeExecution.setNodeKey(node.getNodeKey());
            nodeExecution.setFlinkJobId(node.getFlinkJobId());
            nodeExecution.setStatus(EXECUTION_STATUS_PENDING);
            nodeExecution.setRetryIndex(0);
            nodeExecution.setTenantId(workflow.getTenantId());
            nodeExecutionMapper.insert(nodeExecution);
            executionLogService.appendNodeExecutionLog(execution, nodeExecution, "INFO", "NODE_PENDING", "节点已进入等待队列");
            nodeExecutions.put(node.getNodeKey(), nodeExecution);
        }

        submitWorkflowExecution(workflow, execution, nodes, edges, nodeExecutions);
        workflow.setLastRunTime(execution.getStartedAt());
        updateById(workflow);
        return SchedulerExecutionResponse.from(execution);
    }

    public SchedulerExecutionResponse cancelExecution(Long executionId) {
        SchedulerExecution execution = getExecutionRequired(executionId);
        if (isTerminalExecutionStatus(execution.getStatus())) {
            return SchedulerExecutionResponse.from(execution);
        }
        execution.setStatus(EXECUTION_STATUS_CANCELED);
        execution.setMessage("用户取消运行");
        execution.setFinishedAt(LocalDateTime.now());
        executionMapper.updateById(execution);
        executionLogService.appendExecutionLog(execution, "WARN", "EXECUTION_CANCELED", "用户取消运行");

        List<SchedulerNodeExecution> activeNodes = nodeExecutionMapper.selectList(new LambdaQueryWrapper<SchedulerNodeExecution>()
                .eq(SchedulerNodeExecution::getExecutionId, executionId)
                .eq(SchedulerNodeExecution::getTenantId, execution.getTenantId())
                .in(SchedulerNodeExecution::getStatus, EXECUTION_STATUS_PENDING, EXECUTION_STATUS_RUNNING, EXECUTION_STATUS_RETRYING));
        for (SchedulerNodeExecution nodeExecution : activeNodes) {
            if (EXECUTION_STATUS_RUNNING.equals(nodeExecution.getStatus()) || EXECUTION_STATUS_RETRYING.equals(nodeExecution.getStatus())) {
                workflowRunner.cancelNodeRuntimeJobQuietly(nodeExecution);
                nodeExecution.setStatus(EXECUTION_STATUS_CANCELED);
                nodeExecution.setMessage("用户取消运行，节点已停止");
            } else {
                nodeExecution.setStatus(EXECUTION_STATUS_SKIPPED);
                nodeExecution.setMessage("用户取消运行，节点未执行");
            }
            nodeExecution.setFinishedAt(LocalDateTime.now());
            nodeExecutionMapper.updateById(nodeExecution);
            executionLogService.appendNodeExecutionLog(execution, nodeExecution, "WARN", "NODE_CANCELED", nodeExecution.getMessage());
        }
        return SchedulerExecutionResponse.from(execution);
    }

    public IPage<SchedulerExecution> pageExecutions(Page<SchedulerExecution> page, Long workflowId, String status) {
        return executionMapper.selectPage(page, new LambdaQueryWrapper<SchedulerExecution>()
                .eq(SchedulerExecution::getTenantId, tenantAccessService.requireCurrentTenantId())
                .eq(workflowId != null, SchedulerExecution::getWorkflowId, workflowId)
                .eq(StringUtils.hasText(status), SchedulerExecution::getStatus, status)
                .orderByDesc(SchedulerExecution::getId));
    }

    public List<SchedulerNodeExecution> listNodeExecutions(Long executionId) {
        getExecutionRequired(executionId);
        return nodeExecutionMapper.selectList(new LambdaQueryWrapper<SchedulerNodeExecution>()
                .eq(SchedulerNodeExecution::getExecutionId, executionId)
                .eq(SchedulerNodeExecution::getTenantId, tenantAccessService.requireCurrentTenantId())
                .orderByAsc(SchedulerNodeExecution::getId));
    }

    public List<SchedulerExecutionLog> listExecutionLogs(Long executionId) {
        getExecutionRequired(executionId);
        return executionLogService.listExecutionLogs(executionId, tenantAccessService.requireCurrentTenantId());
    }

    private SchedulerDefinitionResponse buildDefinitionResponse(SchedulerWorkflow workflow) {
        return SchedulerDefinitionResponse.builder()
                .workflow(toWorkflowResponse(workflow))
                .nodes(listNodes(workflow.getId()).stream().map(SchedulerNodeResponse::from).toList())
                .edges(listEdges(workflow.getId()).stream().map(SchedulerEdgeResponse::from).toList())
                .variables(listVariables(workflow.getId()).stream().map(SchedulerVariableResponse::from).toList())
                .build();
    }

    private List<SchedulerWorkflowNode> listNodes(Long workflowId) {
        return nodeMapper.selectList(new LambdaQueryWrapper<SchedulerWorkflowNode>()
                .eq(SchedulerWorkflowNode::getWorkflowId, workflowId)
                .eq(SchedulerWorkflowNode::getTenantId, tenantAccessService.requireCurrentTenantId())
                .orderByAsc(SchedulerWorkflowNode::getId));
    }

    private List<SchedulerWorkflowEdge> listEdges(Long workflowId) {
        return edgeMapper.selectList(new LambdaQueryWrapper<SchedulerWorkflowEdge>()
                .eq(SchedulerWorkflowEdge::getWorkflowId, workflowId)
                .eq(SchedulerWorkflowEdge::getTenantId, tenantAccessService.requireCurrentTenantId())
                .orderByAsc(SchedulerWorkflowEdge::getId));
    }

    private List<SchedulerWorkflowVariable> listVariables(Long workflowId) {
        return variableMapper.selectList(new LambdaQueryWrapper<SchedulerWorkflowVariable>()
                .eq(SchedulerWorkflowVariable::getWorkflowId, workflowId)
                .eq(SchedulerWorkflowVariable::getTenantId, tenantAccessService.requireCurrentTenantId())
                .orderByAsc(SchedulerWorkflowVariable::getId));
    }

    private void assertConcurrentPolicy(SchedulerWorkflow workflow) {
        if (!CONCURRENT_POLICY_SERIAL_RUNS.equals(workflow.getConcurrentPolicy())) {
            return;
        }
        Long runningCount = countRunningExecutions(workflow);
        if (runningCount != null && runningCount > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "工作流已有运行中的实例，当前并发策略禁止重复运行");
        }
    }

    private void assertNoRunningExecution(SchedulerWorkflow workflow) {
        assertNoRunningExecution(workflow, "工作流正在运行中，不能删除");
    }

    private void assertNoRunningExecution(SchedulerWorkflow workflow, String message) {
        Long runningCount = countRunningExecutions(workflow);
        if (runningCount != null && runningCount > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), message);
        }
    }

    private Long countRunningExecutions(SchedulerWorkflow workflow) {
        Long runningCount = executionMapper.selectCount(new LambdaQueryWrapper<SchedulerExecution>()
                .eq(SchedulerExecution::getWorkflowId, workflow.getId())
                .eq(SchedulerExecution::getTenantId, workflow.getTenantId())
                .eq(SchedulerExecution::getStatus, EXECUTION_STATUS_RUNNING));
        return runningCount;
    }

    private void lockWorkflowRunCreation(SchedulerWorkflow workflow) {
        jdbcTemplate.queryForList("SELECT pg_advisory_xact_lock(?)", workflow.getId());
    }

    private void submitWorkflowExecution(
            SchedulerWorkflow workflow,
            SchedulerExecution execution,
            List<SchedulerWorkflowNode> nodes,
            List<SchedulerWorkflowEdge> edges,
            Map<String, SchedulerNodeExecution> nodeExecutions) {
        Runnable task = () -> workflowRunner.execute(workflow, execution, nodes, edges, nodeExecutions);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    submitWorkflowExecutionNow(task, execution, nodeExecutions, false);
                }
            });
            return;
        }
        submitWorkflowExecutionNow(task, execution, nodeExecutions, true);
    }

    private void submitWorkflowExecutionNow(
            Runnable task,
            SchedulerExecution execution,
            Map<String, SchedulerNodeExecution> nodeExecutions,
            boolean propagateFailure) {
        try {
            schedulerExecutor.execute(task);
        } catch (RejectedExecutionException e) {
            execution.setStatus(EXECUTION_STATUS_FAILED);
            execution.setMessage("调度执行器繁忙，提交后台运行失败");
            execution.setFinishedAt(LocalDateTime.now());
            executionMapper.updateById(execution);
            executionLogService.appendExecutionLog(execution, "ERROR", "EXECUTOR_REJECTED", "调度执行器繁忙，提交后台运行失败");
            workflowRunner.markPendingNodesSkipped(execution, nodeExecutions, "调度执行器繁忙，节点未执行");
            log.warn("Scheduler executor rejected workflow execution: executionId={}", execution.getId());
            if (propagateFailure) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "调度执行器繁忙，请稍后重试");
            }
        }
    }

    private SchedulerExecution getExecutionRequired(Long executionId) {
        SchedulerExecution execution = executionMapper.selectOne(new LambdaQueryWrapper<SchedulerExecution>()
                .eq(SchedulerExecution::getId, executionId)
                .eq(SchedulerExecution::getTenantId, tenantAccessService.requireCurrentTenantId())
                .last("LIMIT 1"));
        if (execution == null) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
        return execution;
    }

    private static boolean isTerminalExecutionStatus(String status) {
        return EXECUTION_STATUS_SUCCESS.equals(status)
                || EXECUTION_STATUS_FAILED.equals(status)
                || EXECUTION_STATUS_CANCELED.equals(status);
    }

    private void applyWorkflowRequest(SchedulerWorkflow workflow, SchedulerWorkflowRequest request) {
        workflow.setWorkflowName(request.getWorkflowName().trim());
        workflow.setDescription(request.getDescription());
        workflow.setCron(trimToNull(request.getCron()));
        workflow.setPeriod(trimToNull(request.getPeriod()));
        workflow.setTimezone(defaultString(request.getTimezone(), defaultTimezone));
        workflow.setStatus(defaultString(request.getStatus(), WORKFLOW_STATUS_PAUSED));
        workflow.setExecutionMode(defaultString(request.getExecutionMode(), EXECUTION_MODE_TOPOLOGY));
        workflow.setFailureStrategy(defaultString(request.getFailureStrategy(), FAILURE_STRATEGY_BLOCK_ALL));
        workflow.setConcurrentPolicy(defaultString(request.getConcurrentPolicy(), CONCURRENT_POLICY_SERIAL_RUNS));
        workflow.setAlertChannelId(request.getAlertChannelId());
    }

    private void validateUniqueName(String name, Long tenantId, Long currentId) {
        long count = lambdaQuery()
                .eq(SchedulerWorkflow::getTenantId, tenantId)
                .eq(SchedulerWorkflow::getWorkflowName, name.trim())
                .ne(currentId != null, SchedulerWorkflow::getId, currentId)
                .count();
        if (count > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "工作流名称已存在");
        }
    }

    private void deleteDefinition(SchedulerWorkflow workflow) {
        nodeMapper.delete(new LambdaQueryWrapper<SchedulerWorkflowNode>()
                .eq(SchedulerWorkflowNode::getWorkflowId, workflow.getId())
                .eq(SchedulerWorkflowNode::getTenantId, workflow.getTenantId()));
        edgeMapper.delete(new LambdaQueryWrapper<SchedulerWorkflowEdge>()
                .eq(SchedulerWorkflowEdge::getWorkflowId, workflow.getId())
                .eq(SchedulerWorkflowEdge::getTenantId, workflow.getTenantId()));
        variableMapper.delete(new LambdaQueryWrapper<SchedulerWorkflowVariable>()
                .eq(SchedulerWorkflowVariable::getWorkflowId, workflow.getId())
                .eq(SchedulerWorkflowVariable::getTenantId, workflow.getTenantId()));
    }

    private void deleteChildren(SchedulerWorkflow workflow) {
        deleteDefinition(workflow);
        versionMapper.delete(new LambdaQueryWrapper<SchedulerWorkflowVersion>()
                .eq(SchedulerWorkflowVersion::getWorkflowId, workflow.getId())
                .eq(SchedulerWorkflowVersion::getTenantId, workflow.getTenantId()));
        executionLogService.deleteByWorkflow(workflow.getId(), workflow.getTenantId());
        nodeExecutionMapper.delete(new LambdaQueryWrapper<SchedulerNodeExecution>()
                .eq(SchedulerNodeExecution::getWorkflowId, workflow.getId())
                .eq(SchedulerNodeExecution::getTenantId, workflow.getTenantId()));
        executionMapper.delete(new LambdaQueryWrapper<SchedulerExecution>()
                .eq(SchedulerExecution::getWorkflowId, workflow.getId())
                .eq(SchedulerExecution::getTenantId, workflow.getTenantId()));
    }

    private int countNodes(Long workflowId) {
        return Math.toIntExact(nodeMapper.selectCount(new LambdaQueryWrapper<SchedulerWorkflowNode>()
                .eq(SchedulerWorkflowNode::getWorkflowId, workflowId)
                .eq(SchedulerWorkflowNode::getTenantId, tenantAccessService.requireCurrentTenantId())));
    }

    private String latestVersionName(Long workflowId) {
        SchedulerWorkflowVersion version = latestVersion(workflowId);
        return version == null ? null : version.getVersionName();
    }

    private SchedulerWorkflowVersion latestVersion(Long workflowId) {
        return versionMapper.selectOne(new LambdaQueryWrapper<SchedulerWorkflowVersion>()
                .eq(SchedulerWorkflowVersion::getWorkflowId, workflowId)
                .eq(SchedulerWorkflowVersion::getTenantId, tenantAccessService.requireCurrentTenantId())
                .orderByDesc(SchedulerWorkflowVersion::getVersionNo)
                .last("LIMIT 1"));
    }

    private String latestExecutionStatus(Long workflowId) {
        SchedulerExecution execution = executionMapper.selectOne(new LambdaQueryWrapper<SchedulerExecution>()
                .eq(SchedulerExecution::getWorkflowId, workflowId)
                .eq(SchedulerExecution::getTenantId, tenantAccessService.requireCurrentTenantId())
                .orderByDesc(SchedulerExecution::getId)
                .last("LIMIT 1"));
        return execution == null ? null : execution.getStatus();
    }

    private Integer nextVersionNo(Long workflowId) {
        SchedulerWorkflowVersion version = latestVersion(workflowId);
        return version == null ? 1 : version.getVersionNo() + 1;
    }

    private String writeSnapshot(SchedulerDefinitionResponse definition) {
        try {
            return objectMapper.writeValueAsString(definition);
        } catch (JsonProcessingException e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "工作流版本快照序列化失败");
        }
    }

    private SchedulerNodeRequest toNodeRequest(SchedulerWorkflowNode node) {
        SchedulerNodeRequest request = new SchedulerNodeRequest();
        request.setNodeKey(node.getNodeKey());
        request.setFlinkJobId(node.getFlinkJobId());
        request.setMaxRetries(node.getMaxRetries());
        request.setRetryInterval(node.getRetryInterval());
        request.setTimeoutMinutes(node.getTimeoutMinutes());
        request.setOnTimeout(node.getOnTimeout());
        request.setPositionX(node.getPositionX());
        request.setPositionY(node.getPositionY());
        return request;
    }

    private SchedulerEdgeRequest toEdgeRequest(SchedulerWorkflowEdge edge) {
        SchedulerEdgeRequest request = new SchedulerEdgeRequest();
        request.setFromNodeKey(edge.getFromNodeKey());
        request.setToNodeKey(edge.getToNodeKey());
        request.setStrategy(edge.getStrategy());
        return request;
    }

    private SchedulerVariableRequest toVariableRequest(SchedulerWorkflowVariable variable) {
        SchedulerVariableRequest request = new SchedulerVariableRequest();
        request.setVariableKey(variable.getVariableKey());
        request.setVariableValue(variable.getVariableValue());
        return request;
    }

    private static List<SchedulerNodeRequest> safeNodes(SchedulerDefinitionRequest request) {
        return request == null || request.getNodes() == null ? List.of() : request.getNodes();
    }

    private static List<SchedulerEdgeRequest> safeEdges(SchedulerDefinitionRequest request) {
        return request == null || request.getEdges() == null ? List.of() : request.getEdges();
    }

    private static List<SchedulerVariableRequest> safeVariables(SchedulerDefinitionRequest request) {
        return request == null || request.getVariables() == null ? List.of() : request.getVariables();
    }

    private static String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private static String defaultString(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private static Integer defaultInt(Integer value, Integer fallback) {
        return value == null ? fallback : value;
    }

}
