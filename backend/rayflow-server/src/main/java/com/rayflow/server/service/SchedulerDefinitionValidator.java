package com.rayflow.server.service;

import com.rayflow.common.exception.BusinessException;
import com.rayflow.server.model.request.scheduler.SchedulerDefinitionRequest;
import com.rayflow.server.model.request.scheduler.SchedulerEdgeRequest;
import com.rayflow.server.model.request.scheduler.SchedulerNodeRequest;
import com.rayflow.server.model.request.scheduler.SchedulerVariableRequest;
import com.rayflow.server.model.response.scheduler.SchedulerValidationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class SchedulerDefinitionValidator {

    private final FlinkJobService flinkJobService;

    public SchedulerValidationResponse validate(SchedulerDefinitionRequest request) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<SchedulerNodeRequest> nodes = safeNodes(request);
        List<SchedulerEdgeRequest> edges = safeEdges(request);
        List<SchedulerVariableRequest> variables = safeVariables(request);

        if (nodes.isEmpty()) {
            warnings.add("当前工作流没有节点，保存草稿可通过，但不能发布或运行");
        }

        Set<String> nodeKeys = validateNodes(nodes, errors);
        validateEdges(edges, nodeKeys, errors);
        validateVariables(variables, errors);

        return SchedulerValidationResponse.builder()
                .valid(errors.isEmpty())
                .errors(errors)
                .warnings(warnings)
                .build();
    }

    private Set<String> validateNodes(List<SchedulerNodeRequest> nodes, List<String> errors) {
        Set<String> nodeKeys = new LinkedHashSet<>();
        Set<String> duplicateNodes = new LinkedHashSet<>();
        for (SchedulerNodeRequest node : nodes) {
            String nodeKey = normalize(node.getNodeKey());
            if (!StringUtils.hasText(nodeKey)) {
                errors.add("节点标识不能为空");
                continue;
            }
            if (!nodeKeys.add(nodeKey)) {
                duplicateNodes.add(nodeKey);
            }
            if (node.getFlinkJobId() == null) {
                errors.add("节点 " + nodeKey + " 未绑定 Flink 作业");
            } else {
                try {
                    flinkJobService.getRequired(node.getFlinkJobId());
                } catch (BusinessException e) {
                    errors.add("节点 " + nodeKey + " 绑定的 Flink 作业不存在或无权限访问");
                }
            }
        }
        if (!duplicateNodes.isEmpty()) {
            errors.add("节点标识重复: " + String.join(", ", duplicateNodes));
        }
        return nodeKeys;
    }

    private void validateEdges(List<SchedulerEdgeRequest> edges, Set<String> nodeKeys, List<String> errors) {
        Set<String> edgeKeys = new LinkedHashSet<>();
        for (SchedulerEdgeRequest edge : edges) {
            String from = normalize(edge.getFromNodeKey());
            String to = normalize(edge.getToNodeKey());
            if (!nodeKeys.contains(from)) {
                errors.add("依赖边上游节点不存在: " + from);
            }
            if (!nodeKeys.contains(to)) {
                errors.add("依赖边下游节点不存在: " + to);
            }
            if (from.equals(to)) {
                errors.add("节点不能依赖自身: " + from);
            }
            if (!edgeKeys.add(from + "->" + to)) {
                errors.add("依赖边重复: " + from + " -> " + to);
            }
        }
        if (hasCycle(nodeKeys, edges)) {
            errors.add("DAG 存在循环依赖");
        }
    }

    private void validateVariables(List<SchedulerVariableRequest> variables, List<String> errors) {
        Set<String> variableKeys = new LinkedHashSet<>();
        for (SchedulerVariableRequest variable : variables) {
            String key = normalize(variable.getVariableKey());
            if (StringUtils.hasText(key) && !variableKeys.add(key)) {
                errors.add("变量名重复: " + key);
            }
        }
    }

    private boolean hasCycle(Set<String> nodeKeys, List<SchedulerEdgeRequest> edges) {
        Map<String, List<String>> graph = new HashMap<>();
        Map<String, Integer> indegree = new HashMap<>();
        for (String nodeKey : nodeKeys) {
            graph.put(nodeKey, new ArrayList<>());
            indegree.put(nodeKey, 0);
        }
        for (SchedulerEdgeRequest edge : edges) {
            String from = normalize(edge.getFromNodeKey());
            String to = normalize(edge.getToNodeKey());
            if (!nodeKeys.contains(from) || !nodeKeys.contains(to)) {
                continue;
            }
            graph.get(from).add(to);
            indegree.put(to, indegree.get(to) + 1);
        }
        ArrayDeque<String> queue = new ArrayDeque<>();
        indegree.forEach((nodeKey, degree) -> {
            if (degree == 0) {
                queue.add(nodeKey);
            }
        });
        Set<String> visited = new HashSet<>();
        while (!queue.isEmpty()) {
            String current = queue.removeFirst();
            visited.add(current);
            for (String next : graph.getOrDefault(current, List.of())) {
                int nextDegree = indegree.get(next) - 1;
                indegree.put(next, nextDegree);
                if (nextDegree == 0) {
                    queue.add(next);
                }
            }
        }
        return visited.size() != nodeKeys.size();
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

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
