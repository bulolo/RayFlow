package com.rayflow.server.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.mapper.VariableMapper;
import com.rayflow.server.model.request.resource.VariableRequest;
import com.rayflow.server.model.response.resource.VariableResponse;
import com.rayflow.server.model.entity.Variable;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class VariableService extends ServiceImpl<VariableMapper, Variable> {

    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\$\\{([A-Za-z_][A-Za-z0-9_-]*)}");

    private final TenantAccessService tenantAccessService;

    public List<VariableResponse> listCurrentTenantVariables() {
        return buildTenantVariableQuery()
                .list()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public IPage<VariableResponse> pageCurrentTenantVariables(Page<Variable> page) {
        return buildTenantVariableQuery()
                .page(page)
                .convert(this::toResponse);
    }

    private com.baomidou.mybatisplus.extension.conditions.query.LambdaQueryChainWrapper<Variable> buildTenantVariableQuery() {
        return lambdaQuery()
                .eq(Variable::getTenantId, tenantAccessService.requireCurrentTenantId())
                .orderByAsc(Variable::getVariableName);
    }

    public VariableResponse createVariable(VariableRequest request) {
        Long tenantId = tenantAccessService.requireCurrentTenantId();
        validateUniqueName(request.getVariableName(), tenantId, null);

        Variable entity = new Variable();
        entity.setVariableName(normalizeName(request.getVariableName()));
        entity.setVariableValue(request.getVariableValue() == null ? "" : request.getVariableValue());
        entity.setDescription(trimToNull(request.getDescription()));
        entity.setTenantId(tenantId);
        save(entity);
        return toResponse(entity);
    }

    public VariableResponse updateVariable(Long id, VariableRequest request) {
        Variable existing = getRequired(id);
        validateUniqueName(request.getVariableName(), existing.getTenantId(), id);

        existing.setVariableName(normalizeName(request.getVariableName()));
        existing.setVariableValue(request.getVariableValue() == null ? "" : request.getVariableValue());
        existing.setDescription(trimToNull(request.getDescription()));
        updateById(existing);
        return toResponse(existing);
    }

    public void deleteVariable(Long id) {
        removeById(getRequired(id).getId());
    }

    public String renderSqlForCurrentTenant(String sql) {
        return renderSql(sql, tenantAccessService.requireCurrentTenantId());
    }

    public String renderSql(String sql, Long tenantId) {
        if (sql == null || sql.isBlank()) {
            return sql;
        }

        Map<String, String> variableMap = new LinkedHashMap<>();
        lambdaQuery()
                .eq(Variable::getTenantId, tenantId)
                .orderByAsc(Variable::getVariableName)
                .list()
                .forEach(item -> variableMap.put(item.getVariableName(), item.getVariableValue() == null ? "" : item.getVariableValue()));

        Matcher matcher = PLACEHOLDER_PATTERN.matcher(sql);
        StringBuilder rendered = new StringBuilder();
        String missingName = null;
        while (matcher.find()) {
            String variableName = matcher.group(1);
            if (!variableMap.containsKey(variableName)) {
                missingName = variableName;
                break;
            }
            matcher.appendReplacement(rendered, Matcher.quoteReplacement(variableMap.get(variableName)));
        }

        if (missingName != null) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "未定义的变量: ${" + missingName + "}");
        }

        matcher.appendTail(rendered);
        return rendered.toString();
    }

    public Variable getRequired(Long id) {
        Variable entity = lambdaQuery()
                .eq(Variable::getId, id)
                .eq(Variable::getTenantId, tenantAccessService.requireCurrentTenantId())
                .last("LIMIT 1")
                .one();
        if (entity == null) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
        return entity;
    }

    private void validateUniqueName(String name, Long tenantId, Long currentId) {
        long count = lambdaQuery()
                .eq(Variable::getTenantId, tenantId)
                .eq(Variable::getVariableName, normalizeName(name))
                .ne(currentId != null, Variable::getId, currentId)
                .count();
        if (count > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "变量名已存在");
        }
    }

    private VariableResponse toResponse(Variable entity) {
        VariableResponse response = new VariableResponse();
        response.setId(entity.getId());
        response.setVariableName(entity.getVariableName());
        response.setVariableValue(entity.getVariableValue());
        response.setDescription(entity.getDescription());
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        return response;
    }

    private static String normalizeName(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", "_");
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
