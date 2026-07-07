package com.rayflow.server.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.rayflow.common.result.R;
import com.rayflow.server.model.request.resource.VariableRequest;
import com.rayflow.server.model.response.resource.VariableResponse;
import com.rayflow.server.model.entity.Variable;
import com.rayflow.server.model.vo.PageResponse;
import com.rayflow.server.service.VariableService;
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

@Tag(name = "Variable Management")
@RestController
@RequestMapping("/api/variables")
@RequiredArgsConstructor
public class VariableController {

    private final VariableService variableService;

    @Operation(summary = "获取当前组织变量列表", operationId = "listVariables")
    @GetMapping
    public R<PageResponse<VariableResponse>> list(
            @RequestParam(name = "is_pager", defaultValue = "0") int isPager,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        if (isPager != 1) {
            return R.ok(PageResponse.of(variableService.listCurrentTenantVariables()));
        }
        IPage<VariableResponse> variables = variableService.pageCurrentTenantVariables(
                new Page<Variable>(Math.max(page, 1), Math.max(size, 1))
        );
        return R.ok(PageResponse.from(variables));
    }

    @Operation(summary = "创建变量", operationId = "createVariable")
    @PostMapping
    public R<VariableResponse> create(@Valid @RequestBody VariableRequest request) {
        return R.ok(variableService.createVariable(request));
    }

    @Operation(summary = "更新变量", operationId = "updateVariable")
    @PutMapping("/{id}")
    public R<VariableResponse> update(@PathVariable Long id, @Valid @RequestBody VariableRequest request) {
        return R.ok(variableService.updateVariable(id, request));
    }

    @Operation(summary = "删除变量", operationId = "deleteVariable")
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable Long id) {
        variableService.deleteVariable(id);
        return R.ok();
    }
}
