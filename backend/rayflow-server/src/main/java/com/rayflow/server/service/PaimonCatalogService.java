package com.rayflow.server.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.mapper.PaimonCatalogMapper;
import com.rayflow.server.model.entity.PaimonCatalog;
import com.rayflow.server.security.SecretCipher;
import io.minio.BucketExistsArgs;
import io.minio.MinioClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Paimon Catalog 服务
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PaimonCatalogService extends ServiceImpl<PaimonCatalogMapper, PaimonCatalog> {

    private final ObjectMapper objectMapper;
    private final TenantAccessService tenantAccessService;
    private final SecretCipher secretCipher;

    public List<PaimonCatalog> listCurrentTenantCatalogs() {
        return buildTenantCatalogQuery()
                .list()
                .stream()
                .map(this::maskCatalogSecrets)
                .toList();
    }

    public IPage<PaimonCatalog> pageCurrentTenantCatalogs(Page<PaimonCatalog> page) {
        IPage<PaimonCatalog> result = buildTenantCatalogQuery().page(page);
        result.setRecords(result.getRecords().stream().map(this::maskCatalogSecrets).toList());
        return result;
    }

    private com.baomidou.mybatisplus.extension.conditions.query.LambdaQueryChainWrapper<PaimonCatalog> buildTenantCatalogQuery() {
        return lambdaQuery()
                .eq(PaimonCatalog::getTenantId, tenantAccessService.requireCurrentTenantId())
                .orderByDesc(PaimonCatalog::getId);
    }

    public PaimonCatalog getRequired(Long id) {
        return maskCatalogSecrets(getRequiredStorage(id));
    }

    public PaimonCatalog getRequiredRuntimeCatalog(Long id) {
        return getRequiredStorage(id);
    }

    public Map<String, String> readRuntimeOptions(PaimonCatalog catalog) {
        return readOptions(catalog);
    }

    public S3RuntimeConfig readS3RuntimeConfig(PaimonCatalog catalog) {
        Map<String, String> options = readOptions(catalog);
        String endpoint = firstText(options, "s3.endpoint", "fs.s3a.endpoint");
        String accessKey = firstText(options, "s3.access-key", "fs.s3a.access.key", "fs.s3a.access-key");
        String secretKey = firstText(options, "s3.secret-key", "fs.s3a.secret.key", "fs.s3a.secret-key");
        if (endpoint == null || accessKey == null || secretKey == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Paimon Catalog 缺少 S3 endpoint/access-key/secret-key 配置");
        }
        return new S3RuntimeConfig(endpoint, accessKey, secretKey);
    }

    private PaimonCatalog getRequiredStorage(Long id) {
        PaimonCatalog catalog = lambdaQuery()
                .eq(PaimonCatalog::getId, id)
                .eq(PaimonCatalog::getTenantId, tenantAccessService.requireCurrentTenantId())
                .last("LIMIT 1")
                .one();
        if (catalog == null) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
        return catalog;
    }

    public void createCatalog(PaimonCatalog catalog) {
        validateCatalog(catalog, null);
        catalog.setOptions(writeOptions(encryptSecretOptions(readOptions(catalog))));
        catalog.setTenantId(tenantAccessService.requireCurrentTenantId());
        save(catalog);
    }

    public void updateCatalog(Long id, PaimonCatalog catalog) {
        PaimonCatalog existing = getRequiredStorage(id);
        catalog.setId(existing.getId());
        catalog.setTenantId(existing.getTenantId());
        catalog.setOptions(writeOptions(mergeAndEncryptOptions(existing, catalog)));
        validateCatalog(catalog, id);
        updateById(catalog);
    }

    public void deleteCatalog(Long id) {
        getRequired(id);
        if (!removeById(id)) {
            throw new BusinessException(ResultCode.NOT_FOUND);
        }
    }

    public boolean checkCatalog(Long id) {
        PaimonCatalog catalog = getRequiredStorage(id);
        boolean ok = false;
        try {
            if (catalog.getWarehouse() != null && catalog.getWarehouse().startsWith("s3://")) {
                ok = checkS3Warehouse(catalog);
            } else if (catalog.getWarehouse() != null && catalog.getWarehouse().startsWith("file://")) {
                ok = java.nio.file.Files.exists(Path.of(URI.create(catalog.getWarehouse())));
            }
        } catch (Exception e) {
            log.warn("Check catalog failed for id={}: {}", id, e.getMessage());
            ok = false;
        }
        String nextStatus = ok ? "ACTIVE" : "UNREACHABLE";
        if (!nextStatus.equals(catalog.getStatus())) {
            catalog.setStatus(nextStatus);
            updateById(catalog);
        }
        return ok;
    }

    private void validateCatalog(PaimonCatalog catalog, Long currentId) {
        if (catalog.getOptions() != null && !catalog.getOptions().isBlank()) {
            try {
                objectMapper.readTree(catalog.getOptions());
            } catch (Exception e) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Options 必须是合法 JSON");
            }
        }

        Long duplicateCount = lambdaQuery()
                .eq(PaimonCatalog::getTenantId, tenantAccessService.requireCurrentTenantId())
                .eq(PaimonCatalog::getCatalogName, catalog.getCatalogName())
                .ne(currentId != null, PaimonCatalog::getId, currentId)
                .count();
        if (duplicateCount > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Catalog 名称已存在");
        }
    }

    private Map<String, String> readOptions(PaimonCatalog catalog) {
        if (catalog.getOptions() == null || catalog.getOptions().isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            Map<String, String> options = new LinkedHashMap<>(objectMapper.readValue(catalog.getOptions(), new TypeReference<Map<String, String>>() {}));
            decryptSecretOptions(options);
            return options;
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Options 必须是合法 JSON");
        }
    }

    private boolean checkS3Warehouse(PaimonCatalog catalog) {
        try {
            S3RuntimeConfig config = readS3RuntimeConfig(catalog);
            URI warehouseUri = URI.create(catalog.getWarehouse());
            String bucket = warehouseUri.getHost();
            if (bucket == null || bucket.isBlank()) {
                return false;
            }
            MinioClient client = MinioClient.builder()
                    .endpoint(config.endpoint())
                    .credentials(config.accessKey(), config.secretKey())
                    .build();
            return client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
        } catch (IOException | IllegalArgumentException e) {
            log.warn("Paimon catalog S3 warehouse unreachable: {}", catalog.getWarehouse());
            return false;
        } catch (Exception e) {
            log.warn("Paimon catalog S3 warehouse check failed: {}", catalog.getWarehouse(), e);
            return false;
        }
    }

    private static String firstText(Map<String, String> options, String... keys) {
        for (String key : keys) {
            String value = options.get(key);
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private Map<String, String> mergeAndEncryptOptions(PaimonCatalog existing, PaimonCatalog nextCatalog) {
        Map<String, String> current = readOptions(existing);
        Map<String, String> next = readOptions(nextCatalog);
        for (String key : secretOptionKeys()) {
            String value = next.get(key);
            if (value != null && value.contains("******")) {
                String currentValue = current.get(key);
                if (currentValue != null) {
                    next.put(key, currentValue);
                }
            }
        }
        return encryptSecretOptions(next);
    }

    private PaimonCatalog maskCatalogSecrets(PaimonCatalog catalog) {
        if (catalog == null) {
            return null;
        }
        PaimonCatalog copy = new PaimonCatalog();
        copy.setId(catalog.getId());
        copy.setCatalogName(catalog.getCatalogName());
        copy.setWarehouse(catalog.getWarehouse());
        copy.setMetastoreType(catalog.getMetastoreType());
        copy.setStatus(catalog.getStatus());
        copy.setDescription(catalog.getDescription());
        copy.setTenantId(catalog.getTenantId());
        copy.setCreatedAt(catalog.getCreatedAt());
        copy.setUpdatedAt(catalog.getUpdatedAt());
        copy.setDeleted(catalog.getDeleted());
        Map<String, String> options = readOptions(catalog);
        for (String key : secretOptionKeys()) {
            if (options.containsKey(key) && options.get(key) != null && !options.get(key).isBlank()) {
                options.put(key, "******");
            }
        }
        copy.setOptions(writeOptions(options));
        return copy;
    }

    private Map<String, String> encryptSecretOptions(Map<String, String> options) {
        for (String key : secretOptionKeys()) {
            String value = options.get(key);
            if (value != null && !value.isBlank() && !value.contains("******")) {
                options.put(key, secretCipher.encrypt(value));
            }
        }
        return options;
    }

    private void decryptSecretOptions(Map<String, String> options) {
        for (String key : secretOptionKeys()) {
            String value = options.get(key);
            if (value != null && !value.isBlank() && !value.contains("******")) {
                options.put(key, secretCipher.decrypt(value));
            }
        }
    }

    private String writeOptions(Map<String, String> options) {
        try {
            return objectMapper.writeValueAsString(options == null ? Map.of() : options);
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Options 序列化失败");
        }
    }

    private static List<String> secretOptionKeys() {
        return List.of("s3.secret-key", "fs.s3a.secret.key", "fs.s3a.secret-key");
    }

    public record S3RuntimeConfig(String endpoint, String accessKey, String secretKey) {}
}
