package com.rayflow.server.service;

import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.model.entity.FlinkCluster;
import com.rayflow.server.model.entity.FlinkJob;
import com.rayflow.server.service.submit.SqlRunnerJarResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.Base64;
import java.util.Locale;
import java.util.UUID;

/**
 * K8s SQL 作业镜像发布器。
 *
 * <p>原实现直接在后端容器里调用宿主机 Docker Socket（存在特权逃逸安全风险），
 * 且构建过程阻塞 HTTP 线程长达数分钟。
 *
 * <p>当前实现改为：
 * <ol>
 *   <li>将构建上下文（SQL 内容、Runner JAR、镜像仓库凭证）序列化后，
 *       通过 HTTP 提交给 {@code rayflow-worker} 容器；</li>
 *   <li>{@code worker} 容器以 Docker-in-Docker 模式独立运行 {@code docker buildx build}，
 *       不依赖宿主机 Docker Socket；</li>
 *   <li>提交接口立即返回 {@code taskId}，由 {@link ImageBuildTaskPoller} 后台轮询更新版本状态。</li>
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FlinkJobImagePublisher {

    public static final String SQL_RUNNER_JAR_URI = "local:///opt/rayflow/usrlib/rayflow-flink-sql-runner.jar";
    public static final String SQL_FILE_PATH = "/opt/rayflow/jobs/job.sql";

    private final ImageRegistryConfigService imageRegistryConfigService;
    private final SqlRunnerJarResolver sqlRunnerJarResolver;
    private final ImageBuildWorkerClient workerClient;
    private final FlinkClusterService flinkClusterService;

    @Value("${rayflow.flink.builtin-runtime.image:flink:2.2.1}")
    private String defaultFlinkImage;

    @Value("${rayflow.image-publish.proxy:}")
    private String buildProxy;

    public boolean supports(FlinkJob job) {
        return "SQL".equalsIgnoreCase(job.getJobType())
                && ("K8S_APPLICATION".equalsIgnoreCase(job.getSubmitType())
                || "k8s-application".equalsIgnoreCase(job.getExecutionMode()));
    }

    /**
     * 提交镜像构建任务给 worker 服务，立即返回 taskId（非阻塞）。
     *
     * @return taskId（非 K8s 作业时返回 {@code null}）
     */
    public String submitBuild(FlinkJob job, int versionNo) {
        if (!supports(job)) {
            return null;
        }
        if (!StringUtils.hasText(job.getContent())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "K8s SQL 作业内容不能为空，无法发布镜像");
        }

        ImageRegistryConfigService.RegistryCredential registry =
                imageRegistryConfigService.requireEnabledCredential(job.getTenantId());

        String runnerJarBase64 = encodeRunnerJar();

        boolean insecure = registry.registryUrl().toLowerCase(Locale.ROOT).startsWith("http://");

        String taskId = UUID.randomUUID().toString();

        ImageBuildWorkerClient.BuildPayload payload = new ImageBuildWorkerClient.BuildPayload(
                taskId,
                registry.registryUrl(),
                registry.registryAuthority(),
                registry.namespaceName(),
                registry.username(),
                registry.password(),
                job.getContent(),
                job.getJobName(),
                versionNo,
                resolveFlinkBaseImage(job),
                runnerJarBase64,
                insecure,
                buildProxy
        );

        String returnedTaskId = workerClient.submitBuild(payload);
        log.info("[image-publisher] submitted async build: job={} versionNo={} taskId={}", job.getJobName(), versionNo, returnedTaskId);
        return returnedTaskId;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private String encodeRunnerJar() {
        File jarFile = sqlRunnerJarResolver.resolve();
        try {
            byte[] bytes = Files.readAllBytes(jarFile.toPath());
            return Base64.getEncoder().encodeToString(bytes);
        } catch (IOException e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                    "读取 SQL Runner JAR 失败: " + e.getMessage(), e);
        }
    }

    private String resolveFlinkBaseImage(FlinkJob job) {
        if (job.getClusterId() != null) {
            FlinkCluster cluster = flinkClusterService.getById(job.getClusterId());
            if (cluster != null && StringUtils.hasText(cluster.getImage())) {
                return cluster.getImage().trim();
            }
        }
        return defaultFlinkImage;
    }
}
