package com.rayflow.server.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.rayflow.common.result.R;
import com.rayflow.server.model.request.flink.FlinkJobRequest;
import com.rayflow.server.model.request.flink.FlinkJobVersionRequest;
import com.rayflow.server.model.request.flink.SavepointRequest;
import com.rayflow.server.model.response.flink.FlinkCheckpointResponse;
import com.rayflow.server.model.response.flink.FlinkJobExecutionResponse;
import com.rayflow.server.model.response.flink.FlinkJobResponse;
import com.rayflow.server.model.response.flink.FlinkJobVersionResponse;
import com.rayflow.server.model.response.flink.FlinkSavepointRecordResponse;
import com.rayflow.server.model.response.flink.FlinkSavepointResponse;
import com.rayflow.server.model.entity.FlinkJob;
import com.rayflow.server.model.vo.PageResponse;
import com.rayflow.server.service.FlinkSavepointService;
import com.rayflow.server.service.FlinkJobService;
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

/**
 * Flink 作业管理
 */
@Tag(name = "Flink Job Management")
@RestController
@RequestMapping("/api/flink")
@RequiredArgsConstructor
public class FlinkJobController {

    private final FlinkJobService flinkJobService;
    private final FlinkSavepointService flinkSavepointService;

    @Operation(summary = "分页查询作业列表", operationId = "listFlinkJobs")
    @GetMapping("/jobs")
    public R<PageResponse<FlinkJobResponse>> list(
            @RequestParam(name = "is_pager", defaultValue = "1") int isPager,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(name = "job_type", required = false) String jobType) {
        if (isPager != 1) {
            return R.ok(PageResponse.of(flinkJobService.listJobs(keyword, status, jobType), FlinkJobResponse::from));
        }
        Page<FlinkJob> pageRequest = new Page<>(Math.max(page, 1), Math.max(size, 1));
        IPage<FlinkJob> result = flinkJobService.pageJobs(pageRequest, keyword, status, jobType);
        return R.ok(PageResponse.from(result, FlinkJobResponse::from));
    }

    @Operation(summary = "获取作业详情", operationId = "getFlinkJob")
    @GetMapping("/jobs/{id}")
    public R<FlinkJobResponse> detail(@PathVariable Long id) {
        return R.ok(FlinkJobResponse.from(flinkJobService.getRequired(id)));
    }

    @Operation(summary = "创建作业", operationId = "createFlinkJob")
    @PostMapping("/jobs")
    public R<FlinkJobResponse> submit(@Valid @RequestBody FlinkJobRequest request) {
        return R.ok(FlinkJobResponse.from(flinkJobService.createJob(toEntity(request))));
    }

    @Operation(summary = "启动作业", operationId = "startFlinkJob")
    @PostMapping("/jobs/{id}:start")
    public R<FlinkJobResponse> start(@PathVariable Long id) {
        return R.ok(FlinkJobResponse.from(flinkJobService.startJob(id)));
    }

    @Operation(summary = "调试作业草稿", operationId = "debugFlinkJob")
    @PostMapping("/jobs/{id}:debug")
    public R<FlinkJobResponse> debug(@PathVariable Long id) {
        return R.ok(FlinkJobResponse.from(flinkJobService.debugJob(id)));
    }

    @Operation(summary = "发布作业版本", operationId = "publishFlinkJob")
    @PostMapping("/jobs/{id}:publish")
    public R<FlinkJobVersionResponse> publish(@PathVariable Long id, @RequestBody(required = false) FlinkJobVersionRequest request) {
        return R.ok(flinkJobService.publishVersion(id, request == null ? null : request.getRemark()));
    }

    @Operation(summary = "查询作业版本列表", operationId = "listFlinkJobVersions")
    @GetMapping("/jobs/{id}/versions")
    public R<List<FlinkJobVersionResponse>> listVersions(@PathVariable Long id) {
        return R.ok(flinkJobService.listVersions(id));
    }

    @Operation(summary = "查询作业执行历史", operationId = "listFlinkJobExecutions")
    @GetMapping("/jobs/{id}/executions")
    public R<List<FlinkJobExecutionResponse>> listExecutions(@PathVariable Long id) {
        return R.ok(flinkJobService.listExecutions(id).stream()
                .map(FlinkJobExecutionResponse::from)
                .toList());
    }

    @Operation(summary = "更新作业", operationId = "updateFlinkJob")
    @PutMapping("/jobs/{id}")
    public R<Void> update(@PathVariable Long id, @Valid @RequestBody FlinkJobRequest request) {
        flinkJobService.updateJob(id, toEntity(request));
        return R.ok();
    }

    @Operation(summary = "取消作业", operationId = "cancelFlinkJob")
    @PostMapping("/jobs/{id}:cancel")
    public R<Void> cancel(@PathVariable Long id) {
        flinkJobService.cancelJob(id);
        return R.ok();
    }

    @Operation(summary = "触发 Savepoint", operationId = "triggerFlinkSavepoint")
    @PostMapping("/jobs/{id}:triggerSavepoint")
    public R<FlinkSavepointResponse> triggerSavepoint(@PathVariable Long id, @RequestBody SavepointRequest request) {
        return R.ok(flinkSavepointService.trigger(
                id,
                request.getTargetDirectory(),
                Boolean.TRUE.equals(request.getCancelJob())
        ));
    }

    @Operation(summary = "查询作业 Savepoint 列表", operationId = "listFlinkSavepoints")
    @GetMapping("/jobs/{id}/savepoints")
    public R<List<FlinkSavepointRecordResponse>> listSavepoints(@PathVariable Long id) {
        return R.ok(flinkSavepointService.listByJob(id));
    }

    @Operation(summary = "查询作业 Checkpoint 状态", operationId = "getFlinkCheckpoints")
    @GetMapping("/jobs/{id}/checkpoints")
    public R<FlinkCheckpointResponse> getCheckpoints(@PathVariable Long id) {
        return R.ok(flinkSavepointService.getCheckpoints(id));
    }

    @Operation(summary = "删除作业", operationId = "deleteFlinkJob")
    @DeleteMapping("/jobs/{id}")
    public R<Void> delete(@PathVariable Long id) {
        flinkJobService.deleteJob(id);
        return R.ok();
    }

    private static FlinkJob toEntity(FlinkJobRequest request) {
        FlinkJob job = new FlinkJob();
        job.setJobName(request.getJobName());
        job.setJobGroup(request.getJobGroup());
        job.setJobType(request.getJobType());
        job.setRuntimeMode("SQL".equalsIgnoreCase(request.getJobType()) ? request.getRuntimeMode() : null);
        job.setSubmitType(request.getSubmitType());
        job.setExecutionMode(request.getExecutionMode());
        job.setClusterId(request.getClusterId());
        job.setContent(request.getContent());
        job.setMainClass(request.getMainClass());
        job.setArgs(request.getArgs());
        job.setFlinkConfig(request.getFlinkConfig());
        job.setParallelism(request.getParallelism());
        job.setDescription(request.getDescription());
        job.setDocUrl(request.getDocUrl());
        job.setSavepointPath(request.getSavepointPath());
        job.setApplicationImage(request.getApplicationImage());
        job.setJarUri(request.getJarUri());
        job.setDependencyRefs(request.getDependencyRefs());
        job.setAlertChannelId(request.getAlertChannelId());
        job.setAlertRule(request.getAlertRule() != null ? request.getAlertRule() : "FAILED");
        return job;
    }
}
