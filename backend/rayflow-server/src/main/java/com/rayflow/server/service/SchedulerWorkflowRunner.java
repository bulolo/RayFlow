package com.rayflow.server.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.mapper.SchedulerExecutionMapper;
import com.rayflow.server.mapper.SchedulerNodeExecutionMapper;
import com.rayflow.server.model.entity.FlinkJob;
import com.rayflow.server.model.entity.SchedulerExecution;
import com.rayflow.server.model.entity.SchedulerNodeExecution;
import com.rayflow.server.model.entity.SchedulerWorkflow;
import com.rayflow.server.model.entity.SchedulerWorkflowEdge;
import com.rayflow.server.model.entity.SchedulerWorkflowNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.rayflow.server.model.enums.SchedulerConstants.EDGE_STRATEGY_WAIT_ENDED;
import static com.rayflow.server.model.enums.SchedulerConstants.EDGE_STRATEGY_WAIT_FAILED;
import static com.rayflow.server.model.enums.SchedulerConstants.EDGE_STRATEGY_WAIT_SUCCESS;
import static com.rayflow.server.model.enums.SchedulerConstants.EXECUTION_MODE_SERIAL_QUEUE;
import static com.rayflow.server.model.enums.SchedulerConstants.EXECUTION_STATUS_CANCELED;
import static com.rayflow.server.model.enums.SchedulerConstants.EXECUTION_STATUS_FAILED;
import static com.rayflow.server.model.enums.SchedulerConstants.EXECUTION_STATUS_PENDING;
import static com.rayflow.server.model.enums.SchedulerConstants.EXECUTION_STATUS_RETRYING;
import static com.rayflow.server.model.enums.SchedulerConstants.EXECUTION_STATUS_RUNNING;
import static com.rayflow.server.model.enums.SchedulerConstants.EXECUTION_STATUS_SKIPPED;
import static com.rayflow.server.model.enums.SchedulerConstants.EXECUTION_STATUS_SUCCESS;
import static com.rayflow.server.model.enums.SchedulerConstants.FAILURE_STRATEGY_CONTINUE_NEXT;
import static com.rayflow.server.model.enums.SchedulerConstants.FLINK_STATUS_CANCELED;
import static com.rayflow.server.model.enums.SchedulerConstants.FLINK_STATUS_FAILED;
import static com.rayflow.server.model.enums.SchedulerConstants.FLINK_STATUS_FINISHED;
import static com.rayflow.server.model.enums.SchedulerConstants.FLINK_STATUS_SUSPENDED;

@Slf4j
@Service
@RequiredArgsConstructor
public class SchedulerWorkflowRunner {

    private final FlinkJobService flinkJobService;
    private final SchedulerExecutionMapper executionMapper;
    private final SchedulerNodeExecutionMapper nodeExecutionMapper;
    private final SchedulerExecutionLogService executionLogService;

    public void execute(
            SchedulerWorkflow workflow,
            SchedulerExecution execution,
            List<SchedulerWorkflowNode> nodes,
            List<SchedulerWorkflowEdge> edges,
            Map<String, SchedulerNodeExecution> nodeExecutions) {
        try {
            executionLogService.appendExecutionLog(execution, "INFO", "EXECUTION_STARTED", "工作流开始执行，节点数: " + nodes.size());
            if (isExecutionCanceled(execution.getId())) {
                executionLogService.appendExecutionLog(execution, "WARN", "EXECUTION_CANCELED_BEFORE_START", "工作流启动前已被取消");
                return;
            }
            ExecutionOutcome outcome = executeDagNodes(workflow, execution, nodes, edges, nodeExecutions);
            execution.setHeartbeatAt(LocalDateTime.now());
            if (isExecutionCanceled(execution.getId())) {
                executionLogService.appendExecutionLog(execution, "WARN", "EXECUTION_CANCELED_BEFORE_FINISH", "工作流结束前已被取消");
                return;
            }
            if (outcome.failedCount() > 0) {
                execution.setStatus(EXECUTION_STATUS_FAILED);
                execution.setMessage("工作流运行结束，失败节点 " + outcome.failedCount() + " 个，跳过节点 " + outcome.skippedCount() + " 个");
                executionLogService.appendExecutionLog(execution, "ERROR", "EXECUTION_FAILED", execution.getMessage());
            } else {
                execution.setStatus(EXECUTION_STATUS_SUCCESS);
                execution.setMessage(outcome.skippedCount() > 0
                        ? "工作流运行成功，已跳过未满足依赖条件的节点 " + outcome.skippedCount() + " 个"
                        : "工作流运行成功，所有节点已按依赖完成");
                executionLogService.appendExecutionLog(execution, "INFO", "EXECUTION_SUCCESS", execution.getMessage());
            }
        } catch (Exception e) {
            if (isExecutionCanceled(execution.getId())) {
                executionLogService.appendExecutionLog(execution, "WARN", "EXECUTION_CANCELED_AFTER_ERROR", "工作流异常后检测到已取消: " + e.getMessage());
                return;
            }
            markPendingNodesSkipped(execution, nodeExecutions, "工作流失败阻断，节点未执行");
            execution.setStatus(EXECUTION_STATUS_FAILED);
            execution.setMessage("工作流运行失败: " + e.getMessage());
            executionLogService.appendExecutionLog(execution, "ERROR", "EXECUTION_FAILED", execution.getMessage());
            log.warn("Scheduler workflow execution failed: executionId={}, error={}", execution.getId(), e.getMessage());
        }

        execution.setFinishedAt(LocalDateTime.now());
        execution.setHeartbeatAt(execution.getFinishedAt());
        executionMapper.updateById(execution);
    }

    public void markPendingNodesSkipped(Map<String, SchedulerNodeExecution> nodeExecutions, String message) {
        for (SchedulerNodeExecution nodeExecution : nodeExecutions.values()) {
            if (EXECUTION_STATUS_PENDING.equals(nodeExecution.getStatus())) {
                markNodeSkipped(nodeExecution, message);
            }
        }
    }

    public void markPendingNodesSkipped(SchedulerExecution execution, Map<String, SchedulerNodeExecution> nodeExecutions, String message) {
        for (SchedulerNodeExecution nodeExecution : nodeExecutions.values()) {
            if (EXECUTION_STATUS_PENDING.equals(nodeExecution.getStatus())) {
                markNodeSkipped(nodeExecution, message);
                executionLogService.appendNodeExecutionLog(execution, nodeExecution, "WARN", "NODE_SKIPPED", message);
            }
        }
    }

    public void cancelNodeRuntimeJobQuietly(SchedulerNodeExecution nodeExecution) {
        try {
            flinkJobService.cancelJobForTenant(nodeExecution.getFlinkJobId(), nodeExecution.getTenantId());
        } catch (Exception e) {
            log.warn("Failed to cancel scheduler node runtime job: nodeExecutionId={}, error={}",
                    nodeExecution.getId(), e.getMessage());
        }
    }

    private ExecutionOutcome executeDagNodes(
            SchedulerWorkflow workflow,
            SchedulerExecution execution,
            List<SchedulerWorkflowNode> nodes,
            List<SchedulerWorkflowEdge> edges,
            Map<String, SchedulerNodeExecution> nodeExecutions) {
        Map<String, SchedulerWorkflowNode> nodeByKey = new HashMap<>();
        for (SchedulerWorkflowNode node : nodes) {
            nodeByKey.put(node.getNodeKey(), node);
        }
        int successCount = 0;
        int failedCount = 0;
        int skippedCount = 0;
        List<String> executionOrder = EXECUTION_MODE_SERIAL_QUEUE.equals(workflow.getExecutionMode())
                ? nodes.stream().map(SchedulerWorkflowNode::getNodeKey).toList()
                : topologicalOrder(nodes, edges);
        for (String nodeKey : executionOrder) {
            assertExecutionNotCanceled(execution.getId());
            SchedulerWorkflowNode node = nodeByKey.get(nodeKey);
            SchedulerNodeExecution nodeExecution = nodeExecutions.get(nodeKey);
            if (node == null || nodeExecution == null) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "调度节点不存在: " + nodeKey);
            }
            if (!EXECUTION_MODE_SERIAL_QUEUE.equals(workflow.getExecutionMode()) && !dependenciesSatisfied(nodeKey, edges, nodeExecutions)) {
                markNodeSkipped(nodeExecution, "依赖条件未满足，节点跳过执行");
                executionLogService.appendNodeExecutionLog(execution, nodeExecution, "WARN", "NODE_SKIPPED", "依赖条件未满足，节点跳过执行");
                skippedCount++;
                continue;
            }
            try {
                executeSingleNode(execution, node, nodeExecution);
                successCount++;
            } catch (RuntimeException e) {
                failedCount++;
                if (!FAILURE_STRATEGY_CONTINUE_NEXT.equals(workflow.getFailureStrategy())) {
                    throw e;
                }
            }
        }
        return new ExecutionOutcome(successCount, failedCount, skippedCount);
    }

    private boolean dependenciesSatisfied(
            String nodeKey,
            List<SchedulerWorkflowEdge> edges,
            Map<String, SchedulerNodeExecution> nodeExecutions) {
        List<SchedulerWorkflowEdge> inboundEdges = edges.stream()
                .filter(edge -> nodeKey.equals(edge.getToNodeKey()))
                .toList();
        if (inboundEdges.isEmpty()) {
            return true;
        }
        for (SchedulerWorkflowEdge edge : inboundEdges) {
            SchedulerNodeExecution upstreamExecution = nodeExecutions.get(edge.getFromNodeKey());
            if (upstreamExecution == null || !edgeConditionSatisfied(edge, upstreamExecution.getStatus())) {
                return false;
            }
        }
        return true;
    }

    private static boolean edgeConditionSatisfied(SchedulerWorkflowEdge edge, String upstreamStatus) {
        String strategy = defaultString(edge.getStrategy(), EDGE_STRATEGY_WAIT_SUCCESS);
        if (EDGE_STRATEGY_WAIT_FAILED.equals(strategy)) {
            return EXECUTION_STATUS_FAILED.equals(upstreamStatus);
        }
        if (EDGE_STRATEGY_WAIT_ENDED.equals(strategy)) {
            return EXECUTION_STATUS_SUCCESS.equals(upstreamStatus) || EXECUTION_STATUS_FAILED.equals(upstreamStatus);
        }
        return EXECUTION_STATUS_SUCCESS.equals(upstreamStatus);
    }

    private void markNodeSkipped(SchedulerNodeExecution nodeExecution, String message) {
        nodeExecution.setStatus(EXECUTION_STATUS_SKIPPED);
        nodeExecution.setMessage(message);
        nodeExecution.setFinishedAt(LocalDateTime.now());
        nodeExecutionMapper.updateById(nodeExecution);
    }

    private void executeSingleNode(
            SchedulerExecution execution,
            SchedulerWorkflowNode node,
            SchedulerNodeExecution nodeExecution) {
        int maxRetries = Math.max(defaultInt(node.getMaxRetries(), 0), 0);
        RuntimeException lastError = null;
        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            assertExecutionNotCanceled(execution.getId());
            nodeExecution.setRetryIndex(attempt);
            nodeExecution.setStatus(EXECUTION_STATUS_RUNNING);
            nodeExecution.setMessage(attempt == 0 ? "开始提交 Flink 作业" : "开始第 " + attempt + " 次重试提交 Flink 作业");
            nodeExecution.setStartedAt(LocalDateTime.now());
            nodeExecutionMapper.updateById(nodeExecution);
            executionLogService.appendNodeExecutionLog(execution, nodeExecution, attempt == 0 ? "INFO" : "WARN", attempt == 0 ? "NODE_SUBMITTING" : "NODE_RETRYING", nodeExecution.getMessage());

            try {
                FlinkJob runtimeJob = flinkJobService.startJobForTenant(node.getFlinkJobId(), execution.getTenantId());
                nodeExecution.setFlinkRuntimeJobId(runtimeJob.getFlinkJobId());
                nodeExecution.setMessage("Flink 作业已提交，等待运行终态: " + runtimeJob.getFlinkJobId());
                nodeExecutionMapper.updateById(nodeExecution);
                executionLogService.appendNodeExecutionLog(execution, nodeExecution, "INFO", "NODE_SUBMITTED", nodeExecution.getMessage());

                FlinkJob finishedJob = waitForTerminalJobStatus(runtimeJob, node, execution.getId(), execution.getTenantId(), nodeExecution);
                if (FLINK_STATUS_FINISHED.equals(finishedJob.getStatus())) {
                    nodeExecution.setStatus(EXECUTION_STATUS_SUCCESS);
                    nodeExecution.setMessage("Flink 作业运行完成: " + finishedJob.getFlinkJobId());
                    nodeExecution.setFinishedAt(LocalDateTime.now());
                    nodeExecutionMapper.updateById(nodeExecution);
                    executionLogService.appendNodeExecutionLog(execution, nodeExecution, "INFO", "NODE_SUCCESS", nodeExecution.getMessage());
                    return;
                }
                lastError = new BusinessException(
                        ResultCode.BAD_REQUEST.getCode(),
                        "节点 " + node.getJobName() + " 运行失败，Flink 状态: " + finishedJob.getStatus());
            } catch (RuntimeException e) {
                lastError = e;
            }

            if (isExecutionCanceled(execution.getId())) {
                nodeExecution.setStatus(EXECUTION_STATUS_CANCELED);
                nodeExecution.setMessage("用户取消运行，节点已停止");
                nodeExecution.setFinishedAt(LocalDateTime.now());
                nodeExecutionMapper.updateById(nodeExecution);
                executionLogService.appendNodeExecutionLog(execution, nodeExecution, "WARN", "NODE_CANCELED", nodeExecution.getMessage());
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "工作流运行已取消");
            }

            nodeExecution.setStatus(attempt < maxRetries ? EXECUTION_STATUS_RETRYING : EXECUTION_STATUS_FAILED);
            nodeExecution.setMessage(lastError == null ? "节点运行失败" : lastError.getMessage());
            nodeExecution.setFinishedAt(LocalDateTime.now());
            nodeExecutionMapper.updateById(nodeExecution);
            executionLogService.appendNodeExecutionLog(execution, nodeExecution, attempt < maxRetries ? "WARN" : "ERROR", attempt < maxRetries ? "NODE_RETRY_WAIT" : "NODE_FAILED", nodeExecution.getMessage());

            if (attempt < maxRetries) {
                int retryInterval = Math.max(defaultInt(node.getRetryInterval(), 60), 0);
                executionLogService.appendNodeExecutionLog(execution, nodeExecution, "INFO", "NODE_RETRY_SLEEP", "等待 " + retryInterval + " 秒后重试");
                sleepQuietly(retryInterval * 1000L);
            }
        }

        throw new BusinessException(
                ResultCode.BAD_REQUEST.getCode(),
                lastError == null ? "节点 " + node.getJobName() + " 运行失败" : lastError.getMessage());
    }

    private FlinkJob waitForTerminalJobStatus(
            FlinkJob job,
            SchedulerWorkflowNode node,
            Long executionId,
            Long tenantId,
            SchedulerNodeExecution nodeExecution) {
        int timeoutMinutes = defaultInt(node.getTimeoutMinutes(), 0);
        LocalDateTime deadline = LocalDateTime.now().plusMinutes(timeoutMinutes > 0 ? timeoutMinutes : 30);
        FlinkJob current = job;
        while (LocalDateTime.now().isBefore(deadline)) {
            if (isExecutionCanceled(executionId)) {
                cancelNodeRuntimeJobQuietly(nodeExecution);
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "工作流运行已取消");
            }
            current = flinkJobService.syncJobStatusForTenant(current, tenantId);
            heartbeatExecution(executionId);
            if (isTerminalFlinkStatus(current.getStatus())) {
                executionLogService.appendNodeExecutionLog(null, nodeExecution, "INFO", "NODE_FLINK_TERMINAL", "Flink 作业进入终态: " + current.getStatus());
                return current;
            }
            sleepQuietly(2000L);
        }
        throw new BusinessException(
                ResultCode.BAD_REQUEST.getCode(),
                "节点 " + node.getJobName() + " 运行超时，超过 " + (timeoutMinutes > 0 ? timeoutMinutes : 30) + " 分钟未完成");
    }

    private void assertExecutionNotCanceled(Long executionId) {
        if (isExecutionCanceled(executionId)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "工作流运行已取消");
        }
    }

    private boolean isExecutionCanceled(Long executionId) {
        SchedulerExecution execution = executionMapper.selectById(executionId);
        return execution != null && EXECUTION_STATUS_CANCELED.equals(execution.getStatus());
    }

    private void heartbeatExecution(Long executionId) {
        SchedulerExecution execution = executionMapper.selectById(executionId);
        if (execution == null || !EXECUTION_STATUS_RUNNING.equals(execution.getStatus())) {
            return;
        }
        execution.setHeartbeatAt(LocalDateTime.now());
        executionMapper.updateById(execution);
    }

    private List<String> topologicalOrder(List<SchedulerWorkflowNode> nodes, List<SchedulerWorkflowEdge> edges) {
        Map<String, List<String>> graph = new HashMap<>();
        Map<String, Integer> indegree = new HashMap<>();
        for (SchedulerWorkflowNode node : nodes) {
            graph.put(node.getNodeKey(), new ArrayList<>());
            indegree.put(node.getNodeKey(), 0);
        }
        for (SchedulerWorkflowEdge edge : edges) {
            if (!graph.containsKey(edge.getFromNodeKey()) || !indegree.containsKey(edge.getToNodeKey())) {
                continue;
            }
            graph.get(edge.getFromNodeKey()).add(edge.getToNodeKey());
            indegree.put(edge.getToNodeKey(), indegree.get(edge.getToNodeKey()) + 1);
        }
        ArrayDeque<String> queue = new ArrayDeque<>();
        indegree.forEach((nodeKey, degree) -> {
            if (degree == 0) {
                queue.add(nodeKey);
            }
        });

        List<String> order = new ArrayList<>();
        while (!queue.isEmpty()) {
            String current = queue.removeFirst();
            order.add(current);
            for (String next : graph.getOrDefault(current, List.of())) {
                int degree = indegree.get(next) - 1;
                indegree.put(next, degree);
                if (degree == 0) {
                    queue.add(next);
                }
            }
        }
        if (order.size() != nodes.size()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "DAG 存在循环依赖，不能运行");
        }
        return order;
    }

    private static boolean isTerminalFlinkStatus(String status) {
        return FLINK_STATUS_FINISHED.equals(status)
                || FLINK_STATUS_FAILED.equals(status)
                || FLINK_STATUS_CANCELED.equals(status)
                || FLINK_STATUS_SUSPENDED.equals(status);
    }

    private static void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "调度运行被中断");
        }
    }

    private static String defaultString(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private static Integer defaultInt(Integer value, Integer fallback) {
        return value == null ? fallback : value;
    }

    private record ExecutionOutcome(int successCount, int failedCount, int skippedCount) {
    }
}
