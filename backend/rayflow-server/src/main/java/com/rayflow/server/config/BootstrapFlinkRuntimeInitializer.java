package com.rayflow.server.config;

import com.rayflow.server.model.entity.FlinkCluster;
import com.rayflow.server.service.FlinkClusterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Order(30)
@RequiredArgsConstructor
public class BootstrapFlinkRuntimeInitializer implements ApplicationRunner {
    private static final String PLATFORM_SCOPE = "PLATFORM";

    private final FlinkClusterService flinkClusterService;

    @Value("${rayflow.flink.builtin-runtime.name}")
    private String runtimeName;

    @Value("${rayflow.flink.builtin-runtime.address}")
    private String runtimeAddress;

    @Value("${rayflow.flink.builtin-runtime.gateway-address}")
    private String gatewayAddress;

    @Value("${rayflow.flink.builtin-runtime.version}")
    private String flinkVersion;

    @Value("${rayflow.flink.builtin-runtime.image}")
    private String image;

    @Override
    public void run(ApplicationArguments args) {
        FlinkCluster runtime = flinkClusterService.lambdaQuery()
                .eq(FlinkCluster::getClusterName, runtimeName)
                .eq(FlinkCluster::getClusterScope, PLATFORM_SCOPE)
                .last("LIMIT 1")
                .one();

        if (runtime == null) {
            runtime = new FlinkCluster();
            runtime.setClusterName(runtimeName);
            runtime.setClusterScope(PLATFORM_SCOPE);
            runtime.setTenantId(null);
        }

        runtime.setClusterType("standalone");
        runtime.setDeploymentMode("session");
        runtime.setAddress(runtimeAddress);
        runtime.setGatewayAddress(gatewayAddress);
        runtime.setStatus("RUNNING");
        runtime.setGatewayStatus("RUNNING");
        runtime.setFlinkVersion(flinkVersion);
        runtime.setImage(image);
        runtime.setImagePullPolicy("IfNotPresent");
        runtime.setServiceExposureType(null);
        runtime.setNamespaceName(null);
        runtime.setServiceAccount(null);
        runtime.setKubeConfigRef(null);
        runtime.setPodTemplate(null);
        runtime.setDefaultParallelism(1);
        runtime.setDescription("内置 Flink 运行时");

        if (runtime.getId() == null) {
            flinkClusterService.save(runtime);
            log.info("Built-in Flink runtime created: {}", runtimeName);
        } else {
            flinkClusterService.updateById(runtime);
        }
    }
}
