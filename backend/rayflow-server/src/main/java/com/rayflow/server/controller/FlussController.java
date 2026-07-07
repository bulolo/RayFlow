package com.rayflow.server.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.rayflow.common.result.R;
import com.rayflow.server.model.request.resource.FlussTopicRequest;
import com.rayflow.server.model.response.resource.FlussTopicResponse;
import com.rayflow.server.model.entity.FlussTopic;
import com.rayflow.server.model.vo.PageResponse;
import com.rayflow.server.service.FlussTopicService;
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

/**
 * Fluss 管理
 */
@Tag(name = "Fluss Management")
@RestController
@RequestMapping("/api/fluss/topics")
@RequiredArgsConstructor
public class FlussController {

    private final FlussTopicService flussTopicService;

    @Operation(summary = "获取 Topic 列表", operationId = "listFlussTopics")
    @GetMapping
    public R<PageResponse<FlussTopicResponse>> list(
            @RequestParam(name = "cluster_id", required = false) Long clusterId,
            @RequestParam(name = "is_pager", defaultValue = "0") int isPager,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        if (isPager != 1) {
            return R.ok(PageResponse.of(flussTopicService.listTopics(clusterId), FlussTopicResponse::from));
        }
        IPage<FlussTopic> topics = flussTopicService.pageTopics(
                clusterId,
                new Page<>(Math.max(page, 1), Math.max(size, 1))
        );
        return R.ok(PageResponse.from(topics, FlussTopicResponse::from));
    }

    @Operation(summary = "获取 Topic 详情", operationId = "getFlussTopic")
    @GetMapping("/{id}")
    public R<FlussTopicResponse> detail(@PathVariable Long id) {
        return R.ok(FlussTopicResponse.from(flussTopicService.getRequired(id)));
    }

    @Operation(summary = "创建 Topic", operationId = "createFlussTopic")
    @PostMapping
    public R<Void> create(@Valid @RequestBody FlussTopicRequest request) {
        flussTopicService.createTopic(toEntity(request));
        return R.ok();
    }

    @Operation(summary = "更新 Topic", operationId = "updateFlussTopic")
    @PutMapping("/{id}")
    public R<Void> update(@PathVariable Long id, @Valid @RequestBody FlussTopicRequest request) {
        flussTopicService.updateTopic(id, toEntity(request));
        return R.ok();
    }

    @Operation(summary = "删除 Topic", operationId = "deleteFlussTopic")
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable Long id) {
        flussTopicService.deleteTopic(id);
        return R.ok();
    }

    private static FlussTopic toEntity(FlussTopicRequest request) {
        FlussTopic topic = new FlussTopic();
        topic.setClusterId(request.getClusterId());
        topic.setTopicName(request.getTopicName());
        topic.setNamespaceName(request.getNamespaceName());
        topic.setBucketCount(request.getBucketCount());
        topic.setReplicationFactor(request.getReplicationFactor());
        topic.setStatus(request.getStatus());
        topic.setDescription(request.getDescription());
        return topic;
    }
}
