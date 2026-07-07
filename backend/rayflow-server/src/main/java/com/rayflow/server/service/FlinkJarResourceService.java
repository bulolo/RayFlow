package com.rayflow.server.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.mapper.FlinkJarResourceMapper;
import com.rayflow.server.mapper.FlinkJobMapper;
import com.rayflow.server.model.entity.FlinkJarResource;
import com.rayflow.server.model.entity.FlinkJob;
import com.rayflow.server.model.entity.Tenant;
import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class FlinkJarResourceService extends ServiceImpl<FlinkJarResourceMapper, FlinkJarResource> {

    private static final Pattern JAR_VERSION_PATTERN = Pattern.compile("[-_.](v?\\d+(?:\\.\\d+){1,3}(?:[-_.]?(?:SNAPSHOT|RELEASE|FINAL|RC\\d*|BETA\\d*|ALPHA\\d*))?)$", Pattern.CASE_INSENSITIVE);

    private final TenantAccessService tenantAccessService;
    private final FlinkJobMapper flinkJobMapper;

    @Value("${rayflow.artifact.s3.endpoint}")
    private String artifactEndpoint;

    @Value("${rayflow.artifact.s3.access-key}")
    private String artifactAccessKey;

    @Value("${rayflow.artifact.s3.secret-key}")
    private String artifactSecretKey;

    @Value("${rayflow.artifact.s3.bucket}")
    private String artifactBucket;

    @Value("${rayflow.artifact.s3.region}")
    private String artifactRegion;

    public List<FlinkJarResource> listCurrentTenantResources() {
        return buildTenantResourceQuery().list();
    }

    public IPage<FlinkJarResource> pageCurrentTenantResources(Page<FlinkJarResource> page) {
        return buildTenantResourceQuery().page(page);
    }

    private com.baomidou.mybatisplus.extension.conditions.query.LambdaQueryChainWrapper<FlinkJarResource> buildTenantResourceQuery() {
        return lambdaQuery()
                .eq(FlinkJarResource::getTenantId, tenantAccessService.requireCurrentTenantId())
                .orderByDesc(FlinkJarResource::getId);
    }

    public FlinkJarResource getRequired(Long id) {
        FlinkJarResource resource = lambdaQuery()
                .eq(FlinkJarResource::getId, id)
                .eq(FlinkJarResource::getTenantId, tenantAccessService.requireCurrentTenantId())
                .last("LIMIT 1")
                .one();
        if (resource == null) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
        return resource;
    }

    public void createResource(FlinkJarResource resource) {
        normalize(resource);
        validateUnique(resource, null);
        resource.setTenantId(tenantAccessService.requireCurrentTenantId());
        save(resource);
    }

    public void updateResource(Long id, FlinkJarResource resource) {
        FlinkJarResource existing = getRequired(id);
        resource.setId(existing.getId());
        resource.setTenantId(existing.getTenantId());
        normalize(resource);
        validateUnique(resource, id);
        updateById(resource);
    }

    public void deleteResource(Long id) {
        FlinkJarResource resource = getRequired(id);
        assertNotReferenced(resource);
        if (!removeById(id)) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
    }

    public FlinkJarResource uploadResource(MultipartFile file, FlinkJarResource resource) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "JAR 文件不能为空");
        }
        String originalFilename = file.getOriginalFilename();
        if (!StringUtils.hasText(originalFilename) || !originalFilename.toLowerCase().endsWith(".jar")) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "只支持上传 .jar 文件");
        }

        normalizeUploadResource(resource, originalFilename);
        validateUnique(resource, null);
        Tenant tenant = tenantAccessService.requireCurrentTenant();
        String objectKey = buildObjectKey(tenant.getTenantSlug(), resource);
        String checksum = uploadJarObject(file, objectKey);

        resource.setTenantId(tenant.getId());
        resource.setStorageUri("s3://" + artifactBucket + "/" + objectKey);
        resource.setChecksum(checksum);
        save(resource);
        return resource;
    }

    public List<String> resolveActiveStorageUrisForTenant(String dependencyRefs, Long tenantId) {
        Set<Long> resourceIds = parseDependencyRefs(dependencyRefs);
        if (resourceIds.isEmpty()) {
            return List.of();
        }
        List<FlinkJarResource> resources = lambdaQuery()
                .eq(FlinkJarResource::getTenantId, tenantId)
                .eq(FlinkJarResource::getStatus, "ACTIVE")
                .in(FlinkJarResource::getId, resourceIds)
                .list();
        if (resources.size() != resourceIds.size()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "依赖 JAR 资源不存在或未启用");
        }
        Map<Long, String> uriById = new LinkedHashMap<>();
        for (FlinkJarResource resource : resources) {
            uriById.put(resource.getId(), resource.getStorageUri());
        }
        return resourceIds.stream()
                .map(uriById::get)
                .filter(StringUtils::hasText)
                .toList();
    }

    private static Set<Long> parseDependencyRefs(String dependencyRefs) {
        Set<Long> resourceIds = new LinkedHashSet<>();
        if (!StringUtils.hasText(dependencyRefs)) {
            return resourceIds;
        }
        for (String part : dependencyRefs.split(",")) {
            String trimmed = part.trim();
            if (!StringUtils.hasText(trimmed)) {
                continue;
            }
            try {
                resourceIds.add(Long.parseLong(trimmed));
            } catch (NumberFormatException e) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "依赖资源引用必须是 JAR 资源 ID，多个用逗号分隔");
            }
        }
        return resourceIds;
    }

    private String uploadJarObject(MultipartFile file, String objectKey) {
        try {
            MinioClient client = MinioClient.builder()
                    .endpoint(artifactEndpoint)
                    .credentials(artifactAccessKey, artifactSecretKey)
                    .region(artifactRegion)
                    .build();
            boolean bucketExists = client.bucketExists(BucketExistsArgs.builder().bucket(artifactBucket).build());
            if (!bucketExists) {
                client.makeBucket(MakeBucketArgs.builder().bucket(artifactBucket).build());
            }

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream inputStream = file.getInputStream();
                 DigestInputStream digestInputStream = new DigestInputStream(inputStream, digest)) {
                client.putObject(PutObjectArgs.builder()
                        .bucket(artifactBucket)
                        .object(objectKey)
                        .stream(digestInputStream, file.getSize(), -1)
                        .contentType("application/java-archive")
                        .build());
            }
            return "sha256:" + HexFormat.of().formatHex(digest.digest());
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "上传 JAR 到 S3 失败: " + e.getMessage());
        }
    }

    private static String buildObjectKey(String tenantSlug, FlinkJarResource resource) {
        String resourceName = sanitizePathPart(resource.getResourceName());
        String resourceVersion = sanitizePathPart(resource.getResourceVersion());
        return "flink-jars/"
                + sanitizePathPart(tenantSlug) + "/"
                + resourceName + "/"
                + resourceVersion + "/"
                + resourceName + "-" + resourceVersion + ".jar";
    }

    private static String sanitizePathPart(String value) {
        if (!StringUtils.hasText(value)) {
            return "unknown";
        }
        return value.trim().replaceAll("[^A-Za-z0-9._-]", "-");
    }

    private static void normalizeUploadResource(FlinkJarResource resource, String originalFilename) {
        String filenameWithoutExtension = originalFilename.trim().substring(0, originalFilename.trim().length() - 4);
        if (!StringUtils.hasText(resource.getResourceName())) {
            resource.setResourceName(stripJarVersion(filenameWithoutExtension));
        }
        if (!StringUtils.hasText(resource.getResourceName())) {
            resource.setResourceName(filenameWithoutExtension);
        }
        resource.setResourceName(resource.getResourceName().trim());
        if (resource.getResourceVersion() == null || resource.getResourceVersion().isBlank()) {
            resource.setResourceVersion(inferJarVersion(filenameWithoutExtension));
        }
        resource.setResourceVersion(resource.getResourceVersion().trim());
        if (resource.getCompatibleFlinkVersion() == null || resource.getCompatibleFlinkVersion().isBlank()) {
            resource.setCompatibleFlinkVersion("2.x");
        }
        resource.setCompatibleFlinkVersion(resource.getCompatibleFlinkVersion().trim());
        if (resource.getStatus() == null || resource.getStatus().isBlank()) {
            resource.setStatus("ACTIVE");
        }
        resource.setStatus(resource.getStatus().trim());
        if (!Set.of("ACTIVE", "INACTIVE").contains(resource.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "资源状态不合法");
        }
    }

    private static String stripJarVersion(String filename) {
        return JAR_VERSION_PATTERN.matcher(filename).replaceFirst("");
    }

    private static String inferJarVersion(String filename) {
        Matcher matcher = JAR_VERSION_PATTERN.matcher(filename);
        if (!matcher.find()) {
            return "1.0.0";
        }
        String version = matcher.group(1);
        return version.toLowerCase().startsWith("v") ? version.substring(1) : version;
    }

    private void validateUnique(FlinkJarResource resource, Long currentId) {
        Long duplicateCount = lambdaQuery()
                .eq(FlinkJarResource::getTenantId, tenantAccessService.requireCurrentTenantId())
                .eq(FlinkJarResource::getResourceName, resource.getResourceName())
                .eq(FlinkJarResource::getResourceVersion, resource.getResourceVersion())
                .ne(currentId != null, FlinkJarResource::getId, currentId)
                .count();
        if (duplicateCount > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Flink JAR 资源名称和版本已存在");
        }
    }

    private void normalize(FlinkJarResource resource) {
        if (!StringUtils.hasText(resource.getResourceName())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "资源名称不能为空");
        }
        resource.setResourceName(resource.getResourceName().trim());
        if (!StringUtils.hasText(resource.getStorageUri()) || !resource.getStorageUri().trim().startsWith("s3://")) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "JAR 资源地址必须使用 s3://");
        }
        resource.setStorageUri(resource.getStorageUri().trim());
        if (!resource.getStorageUri().startsWith("s3://" + artifactBucket + "/")) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "JAR 资源必须存储在平台 Artifact Bucket: " + artifactBucket);
        }
        if (resource.getResourceVersion() == null || resource.getResourceVersion().isBlank()) {
            resource.setResourceVersion("1.0.0");
        }
        resource.setResourceVersion(resource.getResourceVersion().trim());
        if (resource.getCompatibleFlinkVersion() == null || resource.getCompatibleFlinkVersion().isBlank()) {
            resource.setCompatibleFlinkVersion("2.x");
        }
        resource.setCompatibleFlinkVersion(resource.getCompatibleFlinkVersion().trim());
        if (resource.getStatus() == null || resource.getStatus().isBlank()) {
            resource.setStatus("ACTIVE");
        }
        resource.setStatus(resource.getStatus().trim());
        if (!Set.of("ACTIVE", "INACTIVE").contains(resource.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "资源状态不合法");
        }
    }

    private void assertNotReferenced(FlinkJarResource resource) {
        List<FlinkJob> jobs = flinkJobMapper.selectList(com.baomidou.mybatisplus.core.toolkit.Wrappers
                .lambdaQuery(FlinkJob.class)
                .eq(FlinkJob::getTenantId, resource.getTenantId()));
        for (FlinkJob job : jobs) {
            if (parseDependencyRefs(job.getDependencyRefs()).contains(resource.getId())) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "JAR 资源已被作业引用，不能删除: " + job.getJobName());
            }
        }
    }
}
