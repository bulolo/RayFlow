package com.rayflow.server.service.submit;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.model.entity.FlinkCluster;
import com.rayflow.server.model.entity.FlinkJob;
import io.fabric8.kubernetes.api.model.GenericKubernetesResource;
import io.fabric8.kubernetes.client.Config;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientBuilder;
import io.fabric8.kubernetes.client.dsl.base.ResourceDefinitionContext;
import io.fabric8.kubernetes.client.utils.Serialization;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

@Slf4j
@Component
@RequiredArgsConstructor
public class K8sOperatorApplicationSubmitter {

    private static final String FLINK_DEPLOYMENT_API_VERSION = "flink.apache.org/v1beta1";
    private static final String FLINK_DEPLOYMENT_KIND = "FlinkDeployment";
    private static final String FLINK_DEPLOYMENT_CRD_NAME = "flinkdeployments.flink.apache.org";
    private static final Pattern INVALID_NAME_CHARS = Pattern.compile("[^a-z0-9-]+");

    private final ObjectMapper objectMapper;

    public String submit(FlinkJob job, FlinkCluster cluster) {
        validate(job, cluster);
        String namespace = namespace(cluster);
        String deploymentName = deploymentName(job);
        String manifest = buildFlinkDeploymentManifest(job, cluster, namespace, deploymentName);

        try (KubernetesClient client = client(cluster)) {
            ensureFlinkDeploymentCrd(client);
            client.load(new ByteArrayInputStream(manifest.getBytes(StandardCharsets.UTF_8)))
                    .inNamespace(namespace)
                    .createOrReplace();
            log.info("K8s Operator application submitted: jobId={}, deployment={}, namespace={}, image={}",
                    job.getId(), deploymentName, namespace, job.getApplicationImage());
            return deploymentName;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "K8s Application 提交失败: " + e.getMessage(), e);
        }
    }

    public OperatorStatus getStatus(FlinkCluster cluster, String deploymentName) {
        if (!StringUtils.hasText(deploymentName)) {
            return null;
        }
        try (KubernetesClient client = client(cluster)) {
            GenericKubernetesResource resource = client.genericKubernetesResources(flinkDeploymentContext())
                    .inNamespace(namespace(cluster))
                    .withName(deploymentName)
                    .get();
            if (resource == null) {
                return new OperatorStatus("FAILED", "FlinkDeployment 不存在: " + deploymentName);
            }
            String jobState = stringValue(resource.get("status", "jobStatus", "state"));
            String lifecycleState = stringValue(resource.get("status", "lifecycleState"));
            String error = firstText(
                    stringValue(resource.get("status", "error")),
                    stringValue(resource.get("status", "jobStatus", "error")),
                    stringValue(resource.get("status", "reconciliationStatus", "error"))
            );
            return new OperatorStatus(mapStatus(jobState, lifecycleState, error), error);
        } catch (Exception e) {
            log.warn("Failed to read FlinkDeployment status: deployment={}, error={}", deploymentName, e.getMessage());
            return null;
        }
    }

    public void cancel(FlinkCluster cluster, String deploymentName) {
        if (!StringUtils.hasText(deploymentName)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "FlinkDeployment 名称为空，无法取消");
        }
        try (KubernetesClient client = client(cluster)) {
            client.genericKubernetesResources(flinkDeploymentContext())
                    .inNamespace(namespace(cluster))
                    .withName(deploymentName)
                    .delete();
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "删除 FlinkDeployment 失败: " + e.getMessage(), e);
        }
    }

    private void validate(FlinkJob job, FlinkCluster cluster) {
        if (!"kubernetes".equalsIgnoreCase(cluster.getClusterType()) || !"application".equalsIgnoreCase(cluster.getDeploymentMode())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "K8s Application 作业必须选择 Kubernetes Application 运行时");
        }
        if (!StringUtils.hasText(job.getApplicationImage())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "K8s Application 作业镜像为空，请先发布并等待镜像构建完成");
        }
        if (!StringUtils.hasText(job.getJarUri())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "K8s Application JAR URI 为空，请先发布版本");
        }
        if (!StringUtils.hasText(job.getMainClass())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "K8s Application 主类为空，请先发布版本");
        }
    }

    private String buildFlinkDeploymentManifest(FlinkJob job, FlinkCluster cluster, String namespace, String deploymentName) {
        Map<String, Object> flinkConfiguration = parseFlinkConfig(job.getFlinkConfig());
        putIfText(flinkConfiguration, "pipeline.name", job.getJobName());
        putIfText(flinkConfiguration, "state.checkpoints.dir", cluster.getCheckpointDir());
        putIfText(flinkConfiguration, "state.savepoints.dir", cluster.getSavepointDir());
        putIfText(flinkConfiguration, "kubernetes.rest-service.exposed.type", serviceExposureType(cluster.getServiceExposureType()));

        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("image", job.getApplicationImage().trim());
        spec.put("flinkVersion", "v2_0");
        spec.put("mode", "native");
        spec.put("serviceAccount", StringUtils.hasText(cluster.getServiceAccount()) ? cluster.getServiceAccount().trim() : "default");
        spec.put("imagePullPolicy", StringUtils.hasText(cluster.getImagePullPolicy()) ? cluster.getImagePullPolicy().trim() : "IfNotPresent");
        spec.put("flinkConfiguration", flinkConfiguration);
        spec.put("jobManager", Map.of("resources", defaultResources()));
        spec.put("taskManager", Map.of("resources", defaultResources()));
        spec.put("job", buildJobSpec(job));
        if (StringUtils.hasText(cluster.getPodTemplate())) {
            spec.put("podTemplate", parseYamlLikeMap(cluster.getPodTemplate(), "Pod Template YAML 解析失败"));
        }

        Map<String, Object> doc = new LinkedHashMap<>();
        doc.put("apiVersion", FLINK_DEPLOYMENT_API_VERSION);
        doc.put("kind", FLINK_DEPLOYMENT_KIND);
        doc.put("metadata", Map.of(
                "name", deploymentName,
                "namespace", namespace,
                "labels", Map.of(
                        "app.kubernetes.io/managed-by", "rayflow",
                        "rayflow.io/job-id", String.valueOf(job.getId())
                )
        ));
        doc.put("spec", spec);
        try {
            return objectMapper.writeValueAsString(doc);
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "FlinkDeployment Manifest 生成失败");
        }
    }

    private Map<String, Object> buildJobSpec(FlinkJob job) {
        Map<String, Object> jobSpec = new LinkedHashMap<>();
        jobSpec.put("jarURI", job.getJarUri().trim());
        jobSpec.put("entryClass", job.getMainClass().trim());
        jobSpec.put("parallelism", job.getParallelism() == null ? 1 : job.getParallelism());
        jobSpec.put("upgradeMode", StringUtils.hasText(job.getSavepointPath()) ? "savepoint" : "stateless");
        jobSpec.put("state", "running");
        if (StringUtils.hasText(job.getArgs())) {
            jobSpec.put("args", splitArgs(job.getArgs()));
        }
        if (StringUtils.hasText(job.getSavepointPath())) {
            jobSpec.put("initialSavepointPath", job.getSavepointPath().trim());
        }
        return jobSpec;
    }

    private Map<String, Object> parseFlinkConfig(String flinkConfig) {
        if (!StringUtils.hasText(flinkConfig)) {
            return new LinkedHashMap<>();
        }
        try {
            return new LinkedHashMap<>(objectMapper.readValue(flinkConfig, new TypeReference<Map<String, Object>>() {}));
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Flink 配置 JSON 解析失败: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseYamlLikeMap(String value, String errorMessage) {
        try {
            Object parsed = Serialization.unmarshal(
                    new ByteArrayInputStream(value.getBytes(StandardCharsets.UTF_8)),
                    new TypeReference<Map<String, Object>>() {}
            );
            if (parsed instanceof Map<?, ?> map) {
                return (Map<String, Object>) map;
            }
            throw new IllegalArgumentException("内容不是 YAML 对象");
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), errorMessage + ": " + e.getMessage());
        }
    }

    private KubernetesClient client(FlinkCluster cluster) {
        Config config;
        String kubeConfigRef = cluster.getKubeConfigRef();
        try {
            if (!StringUtils.hasText(kubeConfigRef)) {
                config = Config.autoConfigure(null);
            } else if (kubeConfigRef.contains("apiVersion:") && kubeConfigRef.contains("clusters:")) {
                config = Config.fromKubeconfig(kubeConfigRef);
            } else {
                config = Config.fromKubeconfig(Files.readString(Paths.get(kubeConfigRef.trim())));
            }
            config.setNamespace(namespace(cluster));
            config.setConnectionTimeout(5000);
            config.setRequestTimeout(10000);
            return new KubernetesClientBuilder().withConfig(config).build();
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Kube Config 解析失败: " + e.getMessage(), e);
        }
    }

    private void ensureFlinkDeploymentCrd(KubernetesClient client) {
        if (client.apiextensions().v1().customResourceDefinitions().withName(FLINK_DEPLOYMENT_CRD_NAME).get() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "目标集群未安装 Flink Kubernetes Operator CRD: " + FLINK_DEPLOYMENT_CRD_NAME);
        }
    }

    private ResourceDefinitionContext flinkDeploymentContext() {
        return new ResourceDefinitionContext.Builder()
                .withGroup("flink.apache.org")
                .withVersion("v1beta1")
                .withKind(FLINK_DEPLOYMENT_KIND)
                .withPlural("flinkdeployments")
                .withNamespaced(true)
                .build();
    }

    private String namespace(FlinkCluster cluster) {
        return StringUtils.hasText(cluster.getNamespaceName()) ? cluster.getNamespaceName().trim() : "default";
    }

    private String deploymentName(FlinkJob job) {
        String base = INVALID_NAME_CHARS.matcher(job.getJobName().toLowerCase(Locale.ROOT)).replaceAll("-");
        base = base.replaceAll("^-+", "").replaceAll("-+$", "");
        if (!StringUtils.hasText(base)) {
            base = "rayflow-job";
        }
        String suffix = "-j" + job.getId();
        int maxBaseLength = Math.max(1, 63 - suffix.length());
        if (base.length() > maxBaseLength) {
            base = base.substring(0, maxBaseLength).replaceAll("-+$", "");
        }
        return base + suffix;
    }

    private static void putIfText(Map<String, Object> map, String key, String value) {
        if (StringUtils.hasText(value) && !map.containsKey(key)) {
            map.put(key, value.trim());
        }
    }

    private static String serviceExposureType(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return switch (value.trim().toUpperCase(Locale.ROOT)) {
            case "CLUSTER_IP" -> "ClusterIP";
            case "NODE_PORT" -> "NodePort";
            case "LOAD_BALANCER" -> "LoadBalancer";
            default -> null;
        };
    }

    private static Map<String, Object> defaultResources() {
        return Map.of("requests", Map.of("memory", "1024m", "cpu", "1"));
    }

    private static String[] splitArgs(String args) {
        return Pattern.compile("\\s+").split(args.trim());
    }

    private static String mapStatus(String jobState, String lifecycleState, String error) {
        if (StringUtils.hasText(error)) {
            return "FAILED";
        }
        String state = firstText(jobState, lifecycleState);
        if (!StringUtils.hasText(state)) {
            return "SUBMITTING";
        }
        return switch (state.trim().toUpperCase(Locale.ROOT)) {
            case "RUNNING", "DEPLOYED", "STABLE", "RECONCILING", "INITIALIZING", "CREATED" -> "RUNNING";
            case "FINISHED" -> "FINISHED";
            case "FAILED", "FAILING", "ERROR" -> "FAILED";
            case "CANCELED", "CANCELLING", "SUSPENDED" -> "CANCELED";
            default -> "RUNNING";
        };
    }

    private static String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static String firstText(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return null;
    }

    public record OperatorStatus(String status, String errorLog) {}
}
