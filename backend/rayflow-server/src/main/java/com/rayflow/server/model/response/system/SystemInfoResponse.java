package com.rayflow.server.model.response.system;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@Schema(name = "SystemInfoResponse")
public class SystemInfoResponse {

    private SystemSummary system;
    private ConnectionStatus database;
    private ConnectionStatus cache;
    private MigrationSummary migration;
    private RuntimeSummary runtimes;
    private ResourceSummary resources;

    @Data
    @Builder
    @Schema(name = "SystemInfoSummary")
    public static class SystemSummary {
        private String app;
        private String version;
        private String environment;
        private String timezone;
        private String javaVersion;
    }

    @Data
    @Builder
    @Schema(name = "SystemInfoConnectionStatus")
    public static class ConnectionStatus {
        private String backend;
        private String connection;
        private Boolean ping;
        private String message;
    }

    @Data
    @Builder
    @Schema(name = "SystemInfoMigrationSummary")
    public static class MigrationSummary {
        private Boolean enabled;
        private String currentVersion;
        private String currentDescription;
        private Boolean success;
    }

    @Data
    @Builder
    @Schema(name = "SystemInfoRuntimeSummary")
    public static class RuntimeSummary {
        private Long total;
        private Long platform;
        private Long tenant;
        private Long running;
        private Long unreachable;
        private Long gatewayRunning;
        private String builtinFlinkVersion;
    }

    @Data
    @Builder
    @Schema(name = "SystemInfoResourceSummary")
    public static class ResourceSummary {
        private Long tenants;
        private Long users;
        private Long flinkJobs;
        private Long schedulerWorkflows;
        private Long paimonCatalogs;
        private Long starRocksConnections;
        private Long flussClusters;
        private List<ResourceTypeCount> lakeResources;
    }

    @Data
    @Builder
    @Schema(name = "SystemInfoResourceTypeCount")
    public static class ResourceTypeCount {
        private String type;
        private Long count;
    }
}
