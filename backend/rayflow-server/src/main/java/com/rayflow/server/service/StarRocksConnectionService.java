package com.rayflow.server.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.mapper.StarRocksConnectionMapper;
import com.rayflow.server.model.entity.StarRocksConnection;
import com.rayflow.server.security.SecretCipher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;
import java.util.Properties;

/**
 * StarRocks connection service.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StarRocksConnectionService extends ServiceImpl<StarRocksConnectionMapper, StarRocksConnection> {

    private final TenantAccessService tenantAccessService;
    private final SecretCipher secretCipher;

    public List<StarRocksConnection> listCurrentTenantConnections() {
        return buildTenantConnectionQuery()
                .list();
    }

    public IPage<StarRocksConnection> pageCurrentTenantConnections(Page<StarRocksConnection> page) {
        return buildTenantConnectionQuery()
                .page(page);
    }

    private com.baomidou.mybatisplus.extension.conditions.query.LambdaQueryChainWrapper<StarRocksConnection> buildTenantConnectionQuery() {
        return lambdaQuery()
                .eq(StarRocksConnection::getTenantId, tenantAccessService.requireCurrentTenantId())
                .orderByDesc(StarRocksConnection::getId);
    }

    public StarRocksConnection getRequired(Long id) {
        StarRocksConnection connection = lambdaQuery()
                .eq(StarRocksConnection::getId, id)
                .eq(StarRocksConnection::getTenantId, tenantAccessService.requireCurrentTenantId())
                .last("LIMIT 1")
                .one();
        if (connection == null) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
        return connection;
    }

    public void createConnection(StarRocksConnection connection) {
        validateConnection(connection, null);
        connection.setPassword(secretCipher.encrypt(connection.getPassword()));
        connection.setTenantId(tenantAccessService.requireCurrentTenantId());
        save(connection);
    }

    public void updateConnection(Long id, StarRocksConnection connection) {
        StarRocksConnection existing = getRequired(id);
        connection.setId(existing.getId());
        connection.setTenantId(existing.getTenantId());
        if (connection.getPassword() == null || connection.getPassword().isBlank()) {
            connection.setPassword(existing.getPassword());
        } else {
            connection.setPassword(secretCipher.encrypt(connection.getPassword()));
        }
        validateConnection(connection, id);
        updateById(connection);
    }

    public void deleteConnection(Long id) {
        getRequired(id);
        if (!removeById(id)) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
    }

    public boolean checkConnection(Long id) {
        StarRocksConnection connection = getRequired(id);
        boolean ok = false;
        try (Connection jdbcConnection = openJdbcConnection(connection);
             Statement statement = jdbcConnection.createStatement()) {
            statement.execute("SELECT 1");
            ok = true;
        } catch (Exception e) {
            String database = normalizeDatabase(connection);
            log.warn("Failed to login to StarRocks FE: {}:{}/{}", connection.getFeAddress(), normalizePort(connection), database, e);
            ok = false;
        }
        String nextStatus = ok ? "ACTIVE" : "UNREACHABLE";
        if (!nextStatus.equals(connection.getStatus())) {
            connection.setStatus(nextStatus);
            updateById(connection);
        }
        return ok;
    }

    public Connection openJdbcConnection(StarRocksConnection connection) throws java.sql.SQLException {
        String host = connection.getFeAddress();
        if (host == null || host.isBlank()) {
            throw new java.sql.SQLException("StarRocks FE 地址不能为空");
        }
        int port = normalizePort(connection);
        String database = normalizeDatabase(connection);
        String jdbcUrl = "jdbc:mysql://" + host.trim() + ":" + port + "/" + database
                + "?connectTimeout=5000&socketTimeout=30000&useSSL=false&allowPublicKeyRetrieval=true";
        Properties properties = new Properties();
        properties.setProperty("user", connection.getUsername() == null ? "" : connection.getUsername().trim());
        properties.setProperty("password", connection.getPassword() == null ? "" : secretCipher.decrypt(connection.getPassword()));
        return DriverManager.getConnection(jdbcUrl, properties);
    }

    public String normalizeDatabase(StarRocksConnection connection) {
        return connection.getDefaultDatabase() == null || connection.getDefaultDatabase().isBlank()
                ? "scm"
                : connection.getDefaultDatabase().trim();
    }

    public int normalizePort(StarRocksConnection connection) {
        return connection.getQueryPort() == null ? 9030 : connection.getQueryPort();
    }

    private void validateConnection(StarRocksConnection connection, Long currentId) {
        Long duplicateCount = lambdaQuery()
                .eq(StarRocksConnection::getTenantId, tenantAccessService.requireCurrentTenantId())
                .eq(StarRocksConnection::getConnectionName, connection.getConnectionName())
                .ne(currentId != null, StarRocksConnection::getId, currentId)
                .count();
        if (duplicateCount > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "StarRocks 连接名称已存在");
        }
    }
}
