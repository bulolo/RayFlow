package com.rayflow.server.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.rayflow.common.result.R;
import com.rayflow.server.model.entity.SchedulerExecution;
import com.rayflow.server.model.entity.SchedulerWorkflow;
import com.rayflow.server.model.request.scheduler.SchedulerDefinitionRequest;
import com.rayflow.server.model.request.scheduler.SchedulerVersionRequest;
import com.rayflow.server.model.request.scheduler.SchedulerWorkflowRequest;
import com.rayflow.server.model.response.scheduler.SchedulerDefinitionResponse;
import com.rayflow.server.model.response.scheduler.SchedulerExecutionLogResponse;
import com.rayflow.server.model.response.scheduler.SchedulerExecutionResponse;
import com.rayflow.server.model.response.scheduler.SchedulerNodeExecutionResponse;
import com.rayflow.server.model.response.scheduler.SchedulerValidationResponse;
import com.rayflow.server.model.response.scheduler.SchedulerVersionResponse;
import com.rayflow.server.model.response.scheduler.SchedulerWorkflowResponse;
import com.rayflow.server.model.vo.PageResponse;
import com.rayflow.server.service.SchedulerWorkflowService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Scheduler Workflow Management")
@RestController
@RequestMapping("/api/scheduler")
@RequiredArgsConstructor
public class SchedulerWorkflowController {

    private final SchedulerWorkflowService schedulerWorkflowService;

    @Operation(summary = "查询调度工作流列表", operationId = "listSchedulerWorkflows")
    @GetMapping("/workflows")
    public R<PageResponse<SchedulerWorkflowResponse>> listWorkflows(
            @RequestParam(name = "is_pager", defaultValue = "1") int isPager,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {
        if (isPager != 1) {
            List<SchedulerWorkflow> workflows = schedulerWorkflowService.listWorkflows(keyword, status);
            return R.ok(PageResponse.of(workflows, schedulerWorkflowService::toWorkflowResponse));
        }
        IPage<SchedulerWorkflow> result = schedulerWorkflowService.pageWorkflows(
                new Page<>(Math.max(page, 1), Math.max(size, 1)),
                keyword,
                status
        );
        return R.ok(PageResponse.from(result, schedulerWorkflowService::toWorkflowResponse));
    }

    @Operation(summary = "获取调度工作流详情", operationId = "getSchedulerWorkflow")
    @GetMapping("/workflows/{id}")
    public R<SchedulerWorkflowResponse> getWorkflow(@PathVariable Long id) {
        return R.ok(schedulerWorkflowService.toWorkflowResponse(schedulerWorkflowService.getRequired(id)));
    }

    @Operation(summary = "创建调度工作流", operationId = "createSchedulerWorkflow")
    @PostMapping("/workflows")
    public R<SchedulerWorkflowResponse> createWorkflow(@Valid @RequestBody SchedulerWorkflowRequest request) {
        return R.ok(schedulerWorkflowService.createWorkflow(request));
    }

    @Operation(summary = "更新调度工作流", operationId = "updateSchedulerWorkflow")
    @PutMapping("/workflows/{id}")
    public R<SchedulerWorkflowResponse> updateWorkflow(@PathVariable Long id, @Valid @RequestBody SchedulerWorkflowRequest request) {
        return R.ok(schedulerWorkflowService.updateWorkflow(id, request));
    }

    @Operation(summary = "删除调度工作流", operationId = "deleteSchedulerWorkflow")
    @DeleteMapping("/workflows/{id}")
    public R<Void> deleteWorkflow(@PathVariable Long id) {
        schedulerWorkflowService.deleteWorkflow(id);
        return R.ok();
    }

    @Operation(summary = "获取调度工作流编排定义", operationId = "getSchedulerWorkflowDefinition")
    @GetMapping("/workflows/{id}/definition")
    public R<SchedulerDefinitionResponse> getDefinition(@PathVariable Long id) {
        return R.ok(schedulerWorkflowService.getDefinition(id));
    }

    @Operation(summary = "保存调度工作流编排定义", operationId = "updateSchedulerWorkflowDefinition")
    @PutMapping("/workflows/{id}/definition")
    public R<SchedulerDefinitionResponse> updateDefinition(@PathVariable Long id, @Valid @RequestBody SchedulerDefinitionRequest request) {
        return R.ok(schedulerWorkflowService.updateDefinition(id, request));
    }

    @Operation(summary = "校验调度工作流编排定义", operationId = "validateSchedulerWorkflow")
    @PostMapping("/workflows/{id}:validate")
    public R<SchedulerValidationResponse> validateWorkflow(@PathVariable Long id) {
        return R.ok(schedulerWorkflowService.validateCurrentDefinition(id));
    }

    @Operation(summary = "发布调度工作流版本", operationId = "publishSchedulerWorkflow")
    @PostMapping("/workflows/{id}:publish")
    public R<SchedulerVersionResponse> publishWorkflow(@PathVariable Long id, @RequestBody(required = false) SchedulerVersionRequest request) {
        return R.ok(schedulerWorkflowService.publishVersion(id, request == null ? null : request.getRemark()));
    }

    @Operation(summary = "手动运行调度工作流", operationId = "runSchedulerWorkflow")
    @PostMapping("/workflows/{id}:run")
    public R<SchedulerExecutionResponse> runWorkflow(@PathVariable Long id) {
        return R.ok(schedulerWorkflowService.runWorkflow(id));
    }

    @Operation(summary = "查询调度工作流版本列表", operationId = "listSchedulerWorkflowVersions")
    @GetMapping("/workflows/{id}/versions")
    public R<List<SchedulerVersionResponse>> listVersions(@PathVariable Long id) {
        return R.ok(schedulerWorkflowService.listVersions(id));
    }

    @Operation(summary = "查询调度运行实例", operationId = "listSchedulerExecutions")
    @GetMapping("/executions")
    public R<PageResponse<SchedulerExecutionResponse>> listExecutions(
            @RequestParam(name = "is_pager", defaultValue = "1") int isPager,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) Long workflowId,
            @RequestParam(required = false) String status) {
        Page<SchedulerExecution> pageRequest = new Page<>(isPager == 1 ? Math.max(page, 1) : 1, isPager == 1 ? Math.max(size, 1) : 1000);
        IPage<SchedulerExecution> result = schedulerWorkflowService.pageExecutions(pageRequest, workflowId, status);
        return R.ok(PageResponse.from(result, SchedulerExecutionResponse::from));
    }

    @Operation(summary = "查询调度节点运行明细", operationId = "listSchedulerNodeExecutions")
    @GetMapping("/executions/{id}/nodes")
    public R<List<SchedulerNodeExecutionResponse>> listNodeExecutions(@PathVariable Long id) {
        return R.ok(schedulerWorkflowService.listNodeExecutions(id).stream()
                .map(SchedulerNodeExecutionResponse::from)
                .toList());
    }

    @Operation(summary = "查询调度运行日志", operationId = "listSchedulerExecutionLogs")
    @GetMapping("/executions/{id}/logs")
    public R<List<SchedulerExecutionLogResponse>> listExecutionLogs(@PathVariable Long id) {
        return R.ok(schedulerWorkflowService.listExecutionLogs(id).stream()
                .map(SchedulerExecutionLogResponse::from)
                .toList());
    }

    @Operation(summary = "取消调度运行实例", operationId = "cancelSchedulerExecution")
    @PostMapping("/executions/{id}:cancel")
    public R<SchedulerExecutionResponse> cancelExecution(@PathVariable Long id) {
        return R.ok(schedulerWorkflowService.cancelExecution(id));
    }
}
