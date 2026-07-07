package com.rayflow.server.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.rayflow.server.mapper.FlinkClusterMapper;
import com.rayflow.server.mapper.FlinkJobMapper;
import com.rayflow.server.mapper.FlussClusterMapper;
import com.rayflow.server.mapper.PaimonCatalogMapper;
import com.rayflow.server.mapper.SchedulerWorkflowMapper;
import com.rayflow.server.mapper.StarRocksConnectionMapper;
import com.rayflow.server.mapper.TenantMapper;
import com.rayflow.server.mapper.UserMapper;
import com.rayflow.server.model.entity.FlinkCluster;
import com.rayflow.server.model.response.system.SystemInfoResponse;
import lombok.RequiredArgsConstructor;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class SystemInfoService {

    private static final Pattern SECRET_MESSAGE_PATTERN = Pattern.compile("(?i)(password|passwd|pwd|secret|token)=([^\\s;&]+)");

    private final JdbcTemplate jdbcTemplate;
    private final RedisConnectionFactory redisConnectionFactory;
    private final Flyway flyway;
    private final Environment environment;
    private final TenantMapper tenantMapper;
    private final UserMapper userMapper;
    private final FlinkJobMapper flinkJobMapper;
    private final SchedulerWorkflowMapper schedulerWorkflowMapper;
    private final PaimonCatalogMapper paimonCatalogMapper;
    private final StarRocksConnectionMapper starRocksConnectionMapper;
    private final FlussClusterMapper flussClusterMapper;
    private final FlinkClusterMapper flinkClusterMapper;

    @Value("${spring.application.name:rayflow-server}")
    private String appName;

    @Value("${rayflow.version:0.0.5}")
    private String version;

    @Value("${rayflow.timezone:UTC}")
    private String timezone;

    @Value("${spring.datasource.url:}")
    private String datasourceUrl;

    @Value("${spring.data.redis.host:localhost}")
    private String redisHost;

    @Value("${spring.data.redis.port:6379}")
    private String redisPort;

    @Value("${rayflow.flink.builtin-runtime.version:}")
    private String builtinFlinkVersion;

    public SystemInfoResponse getSystemInfo() {
        return SystemInfoResponse.builder()
                .system(buildSystemSummary())
                .database(buildDatabaseStatus())
                .cache(buildCacheStatus())
                .migration(buildMigrationSummary())
                .runtimes(buildRuntimeSummary())
                .resources(buildResourceSummary())
                .build();
    }

    private SystemInfoResponse.SystemSummary buildSystemSummary() {
        return SystemInfoResponse.SystemSummary.builder()
                .app(appName)
                .version(version)
                .environment(resolveEnvironment())
                .timezone(timezone)
                .javaVersion(System.getProperty("java.version"))
                .build();
    }

    private String resolveEnvironment() {
        String[] activeProfiles = environment.getActiveProfiles();
        if (activeProfiles.length == 0) {
            return "default";
        }
        return String.join(",", activeProfiles);
    }

    private SystemInfoResponse.ConnectionStatus buildDatabaseStatus() {
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return SystemInfoResponse.ConnectionStatus.builder()
                    .backend("PostgreSQL")
                    .connection(maskJdbcUrl(datasourceUrl))
                    .ping(true)
                    .message("连接正常")
                    .build();
        } catch (Exception e) {
            return SystemInfoResponse.ConnectionStatus.builder()
                    .backend("PostgreSQL")
                    .connection(maskJdbcUrl(datasourceUrl))
                    .ping(false)
                    .message(safeFailureMessage(e))
                    .build();
        }
    }

    private SystemInfoResponse.ConnectionStatus buildCacheStatus() {
        try (RedisConnection connection = redisConnectionFactory.getConnection()) {
            String pong = connection.ping();
            return SystemInfoResponse.ConnectionStatus.builder()
                    .backend("Redis")
                    .connection(redisHost + ":" + redisPort)
                    .ping("PONG".equalsIgnoreCase(pong))
                    .message("PONG".equalsIgnoreCase(pong) ? "连接正常" : String.valueOf(pong))
                    .build();
        } catch (Exception e) {
            return SystemInfoResponse.ConnectionStatus.builder()
                    .backend("Redis")
                    .connection(redisHost + ":" + redisPort)
                    .ping(false)
                    .message(safeFailureMessage(e))
                    .build();
        }
    }

    private SystemInfoResponse.MigrationSummary buildMigrationSummary() {
        try {
            MigrationInfo current = flyway.info().current();
            return SystemInfoResponse.MigrationSummary.builder()
                    .enabled(true)
                    .currentVersion(current == null || current.getVersion() == null ? null : current.getVersion().getVersion())
                    .currentDescription(current == null ? null : current.getDescription())
                    .success(current == null || current.getState().isApplied())
                    .build();
        } catch (Exception e) {
            return SystemInfoResponse.MigrationSummary.builder()
                    .enabled(true)
                    .success(false)
                    .currentDescription(safeFailureMessage(e))
                    .build();
        }
    }

    private SystemInfoResponse.RuntimeSummary buildRuntimeSummary() {
        Long total = flinkClusterMapper.selectCount(null);
        Long platform = flinkClusterMapper.selectCount(new LambdaQueryWrapper<FlinkCluster>()
                .eq(FlinkCluster::getClusterScope, "PLATFORM"));
        Long tenant = flinkClusterMapper.selectCount(new LambdaQueryWrapper<FlinkCluster>()
                .eq(FlinkCluster::getClusterScope, "TENANT"));
        Long running = flinkClusterMapper.selectCount(new LambdaQueryWrapper<FlinkCluster>()
                .eq(FlinkCluster::getStatus, "RUNNING"));
        Long unreachable = flinkClusterMapper.selectCount(new LambdaQueryWrapper<FlinkCluster>()
                .eq(FlinkCluster::getStatus, "UNREACHABLE"));
        Long gatewayRunning = flinkClusterMapper.selectCount(new LambdaQueryWrapper<FlinkCluster>()
                .eq(FlinkCluster::getGatewayStatus, "RUNNING"));
        return SystemInfoResponse.RuntimeSummary.builder()
                .total(total)
                .platform(platform)
                .tenant(tenant)
                .running(running)
                .unreachable(unreachable)
                .gatewayRunning(gatewayRunning)
                .builtinFlinkVersion(builtinFlinkVersion)
                .build();
    }

    private SystemInfoResponse.ResourceSummary buildResourceSummary() {
        Long paimonCatalogs = paimonCatalogMapper.selectCount(null);
        Long starRocksConnections = starRocksConnectionMapper.selectCount(null);
        Long flussClusters = flussClusterMapper.selectCount(null);
        List<SystemInfoResponse.ResourceTypeCount> lakeResources = new ArrayList<>();
        lakeResources.add(SystemInfoResponse.ResourceTypeCount.builder().type("Paimon Catalog").count(paimonCatalogs).build());
        lakeResources.add(SystemInfoResponse.ResourceTypeCount.builder().type("StarRocks").count(starRocksConnections).build());
        lakeResources.add(SystemInfoResponse.ResourceTypeCount.builder().type("Fluss").count(flussClusters).build());

        return SystemInfoResponse.ResourceSummary.builder()
                .tenants(tenantMapper.selectCount(null))
                .users(userMapper.selectCount(null))
                .flinkJobs(flinkJobMapper.selectCount(null))
                .schedulerWorkflows(schedulerWorkflowMapper.selectCount(null))
                .paimonCatalogs(paimonCatalogs)
                .starRocksConnections(starRocksConnections)
                .flussClusters(flussClusters)
                .lakeResources(lakeResources)
                .build();
    }

    private String maskJdbcUrl(String jdbcUrl) {
        if (!StringUtils.hasText(jdbcUrl)) {
            return "";
        }
        if (jdbcUrl.startsWith("jdbc:postgresql://")) {
            try {
                URI uri = URI.create(jdbcUrl.substring("jdbc:".length()));
                String port = uri.getPort() > 0 ? ":" + uri.getPort() : "";
                return uri.getHost() + port + uri.getPath();
            } catch (Exception ignored) {
                return jdbcUrl.replaceFirst("\\?.*$", "");
            }
        }
        return Arrays.stream(jdbcUrl.split("\\?"))
                .findFirst()
                .orElse(jdbcUrl);
    }

    private String safeFailureMessage(Exception e) {
        String message = StringUtils.hasText(e.getMessage()) ? e.getMessage() : e.getClass().getSimpleName();
        return SECRET_MESSAGE_PATTERN.matcher(message).replaceAll("$1=***");
    }
}
