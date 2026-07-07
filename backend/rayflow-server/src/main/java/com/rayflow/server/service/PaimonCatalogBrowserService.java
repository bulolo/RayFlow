package com.rayflow.server.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.flink.client.FlinkSqlGatewayClient;
import org.apache.hadoop.conf.Configuration;
import org.apache.paimon.PagedList;
import org.apache.paimon.Snapshot;
import org.apache.paimon.catalog.Catalog;
import org.apache.paimon.catalog.CatalogContext;
import org.apache.paimon.catalog.CatalogFactory;
import org.apache.paimon.catalog.Identifier;
import org.apache.paimon.index.IndexFileMeta;
import org.apache.paimon.io.DataFileMeta;
import org.apache.paimon.manifest.IndexManifestEntry;
import org.apache.paimon.manifest.ManifestEntry;
import org.apache.paimon.options.Options;
import org.apache.paimon.schema.TableSchema;
import org.apache.paimon.table.FileStoreTable;
import org.apache.paimon.table.Table;
import org.apache.paimon.types.DataField;
import com.rayflow.server.model.entity.FlinkCluster;
import com.rayflow.server.model.entity.PaimonCatalog;
import com.rayflow.server.model.response.resource.PaimonDatabaseResponse;
import com.rayflow.server.model.response.resource.PaimonTableFileContentResponse;
import com.rayflow.server.model.response.resource.PaimonTableDefinitionResponse;
import com.rayflow.server.model.response.resource.PaimonTableFilesResponse;
import com.rayflow.server.model.response.resource.PaimonTablePreviewResponse;
import com.rayflow.server.model.response.resource.PaimonTableResponse;
import com.rayflow.server.model.response.resource.PaimonTableSchemaResponse;
import com.rayflow.server.model.response.resource.PaimonTableSnapshotsResponse;
import io.minio.GetObjectArgs;
import io.minio.GetObjectResponse;
import io.minio.ListObjectsArgs;
import io.minio.MinioClient;
import io.minio.Result;
import io.minio.messages.Item;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaimonCatalogBrowserService {

    private static final String BUILTIN_RUNTIME_NAME = "内置";
    private static final int DEFAULT_PREVIEW_LIMIT = 100;
    private static final int MAX_PREVIEW_LIMIT = 200;
    private static final int MAX_FILE_ENTRIES = 500;
    private static final int MAX_FILE_CONTENT_BYTES = 256 * 1024;

    private final PaimonCatalogService paimonCatalogService;
    private final FlinkClusterService flinkClusterService;
    private final ObjectMapper objectMapper;
    private final Map<String, CacheEntry<?>> cache = new ConcurrentHashMap<>();

    @Value("${rayflow.flink.rest-connect-timeout-ms:3000}")
    private int connectTimeoutMs;

    @Value("${rayflow.flink.rest-read-timeout-ms:120000}")
    private int readTimeoutMs;

    @Value("${rayflow.paimon.browser.cache-ttl-ms:60000}")
    private long cacheTtlMs;

    @Value("${rayflow.paimon.browser.operation-timeout-ms:30000}")
    private long operationTimeoutMs;

    public List<PaimonDatabaseResponse> listDatabases(Long catalogId, boolean refresh) {
        String cacheKey = "databases:" + catalogId;
        return cached(cacheKey, refresh, () -> {
            try (Catalog catalog = createPaimonCatalog(catalogId)) {
                return catalog.listDatabases().stream()
                    .filter(value -> value != null && !value.isBlank())
                    .map(PaimonDatabaseResponse::new)
                    .toList();
            } catch (Exception e) {
                throw paimonApiException("读取 Paimon Database 列表失败", e);
            }
        });
    }

    public List<PaimonTableResponse> listTables(Long catalogId, String databaseName, boolean refresh) {
        String normalizedDatabase = requireIdentifier(databaseName, "databaseName");
        String cacheKey = "tables:" + catalogId + ":" + normalizedDatabase;
        return cached(cacheKey, refresh, () -> {
            try (Catalog catalog = createPaimonCatalog(catalogId)) {
                return catalog.listTables(normalizedDatabase).stream()
                    .filter(value -> value != null && !value.isBlank())
                    .map(table -> new PaimonTableResponse(normalizedDatabase, table))
                    .toList();
            } catch (Exception e) {
                throw paimonApiException("读取 Paimon Table 列表失败", e);
            }
        });
    }

    public PaimonTableSchemaResponse getTableSchema(Long catalogId, String databaseName, String tableName, boolean refresh) {
        String normalizedDatabase = requireIdentifier(databaseName, "databaseName");
        String normalizedTable = requireIdentifier(tableName, "tableName");
        String cacheKey = "schema:" + catalogId + ":" + normalizedDatabase + ":" + normalizedTable;
        return cached(cacheKey, refresh, () -> {
            try (Catalog catalog = createPaimonCatalog(catalogId)) {
                Table table = catalog.getTable(Identifier.create(normalizedDatabase, normalizedTable));
                TableSchema schema = resolveTableSchema(table);
                return PaimonTableSchemaResponse.builder()
                        .databaseName(normalizedDatabase)
                        .tableName(normalizedTable)
                        .columns(schema.fields().stream()
                                .map(field -> toSchemaColumn(field, schema))
                                .toList())
                        .build();
            } catch (Exception e) {
                throw paimonApiException("读取 Paimon Table Schema 失败", e);
            }
        });
    }

    public PaimonTableDefinitionResponse getTableDefinition(Long catalogId, String databaseName, String tableName, boolean refresh) {
        String normalizedDatabase = requireIdentifier(databaseName, "databaseName");
        String normalizedTable = requireIdentifier(tableName, "tableName");
        String cacheKey = "definition:" + catalogId + ":" + normalizedDatabase + ":" + normalizedTable;
        return cached(cacheKey, refresh, () -> {
            try (Catalog catalog = createPaimonCatalog(catalogId)) {
                Table table = catalog.getTable(Identifier.create(normalizedDatabase, normalizedTable));
                TableSchema schema = resolveTableSchema(table);
                Map<String, String> options = new TreeMap<>(schema.options());
                if (!options.containsKey("bucket")) {
                    options.put("bucket", String.valueOf(schema.numBuckets()));
                }
                return PaimonTableDefinitionResponse.builder()
                        .databaseName(normalizedDatabase)
                        .tableName(normalizedTable)
                        .qualifiedName(tableIdentifier(normalizedDatabase, normalizedTable))
                        .schemaId(schema.id())
                        .schemaVersion(schema.version())
                        .comment(schema.comment())
                        .partitionKeys(schema.partitionKeys())
                        .primaryKeys(schema.primaryKeys())
                        .bucketKeys(schema.bucketKeys())
                        .numBuckets(schema.numBuckets())
                        .options(options)
                        .createTableSql(buildCreateTableSql(normalizedDatabase, normalizedTable, schema, options))
                        .build();
            } catch (Exception e) {
                throw paimonApiException("读取 Paimon Table 定义失败", e);
            }
        });
    }

    public PaimonTableFilesResponse listTableFiles(Long catalogId, String databaseName, String tableName, String path, boolean refresh) {
        String normalizedDatabase = requireIdentifier(databaseName, "databaseName");
        String normalizedTable = requireIdentifier(tableName, "tableName");
        String normalizedPath = normalizeRelativePath(path);
        String cacheKey = "files:" + catalogId + ":" + normalizedDatabase + ":" + normalizedTable + ":" + normalizedPath;
        return cached(cacheKey, refresh, () -> {
            try {
                PaimonCatalog catalogConfig = paimonCatalogService.getRequiredRuntimeCatalog(catalogId);
                String tablePath = resolveTablePath(catalogId, normalizedDatabase, normalizedTable);
                S3Location location = parseS3Location(tablePath);
                MinioClient client = createS3Client(catalogConfig);
                String basePrefix = ensureTrailingSlash(location.prefix());
                String currentPrefix = basePrefix + normalizedPath;
                Iterable<Result<Item>> results = client.listObjects(ListObjectsArgs.builder()
                        .bucket(location.bucket())
                        .prefix(currentPrefix)
                        .recursive(false)
                        .build());
                List<PaimonTableFilesResponse.Entry> entries = new ArrayList<>();
                for (Result<Item> result : results) {
                    Item item = result.get();
                    String relative = relativizeObjectName(basePrefix, item.objectName());
                    if (relative.isBlank() || relative.equals(normalizedPath)) {
                        continue;
                    }
                    entries.add(toFileEntry(item, relative));
                    if (entries.size() >= MAX_FILE_ENTRIES) {
                        break;
                    }
                }
                entries.sort(Comparator
                        .comparing((PaimonTableFilesResponse.Entry entry) -> !"directory".equals(entry.getType()))
                        .thenComparing(PaimonTableFilesResponse.Entry::getName));
                return PaimonTableFilesResponse.builder()
                        .databaseName(normalizedDatabase)
                        .tableName(normalizedTable)
                        .tablePath(tablePath)
                        .currentPath(normalizedPath)
                        .parentPath(parentPath(normalizedPath))
                        .entries(entries)
                        .build();
            } catch (Exception e) {
                throw paimonApiException("读取 Paimon Table 文件目录失败", e);
            }
        });
    }

    public PaimonTableFileContentResponse getTableFileContent(Long catalogId, String databaseName, String tableName, String path) {
        String normalizedDatabase = requireIdentifier(databaseName, "databaseName");
        String normalizedTable = requireIdentifier(tableName, "tableName");
        String normalizedPath = normalizeFilePath(path);
        try {
            if (isDataManifestPath(normalizedPath)) {
                return readDataManifestContent(catalogId, normalizedDatabase, normalizedTable, normalizedPath);
            }
            if (isIndexManifestPath(normalizedPath)) {
                return readIndexManifestContent(catalogId, normalizedDatabase, normalizedTable, normalizedPath);
            }
            if (isIndexFilePath(normalizedPath)) {
                return readIndexFileContent(catalogId, normalizedDatabase, normalizedTable, normalizedPath);
            }
            PaimonCatalog catalogConfig = paimonCatalogService.getRequiredRuntimeCatalog(catalogId);
            String tablePath = resolveTablePath(catalogId, normalizedDatabase, normalizedTable);
            S3Location location = parseS3Location(tablePath);
            String objectKey = ensureTrailingSlash(location.prefix()) + normalizedPath;
            MinioClient client = createS3Client(catalogConfig);
            try (GetObjectResponse response = client.getObject(GetObjectArgs.builder()
                    .bucket(location.bucket())
                    .object(objectKey)
                    .build())) {
                byte[] bytes = readPreviewBytes(response);
                boolean truncated = bytes.length > MAX_FILE_CONTENT_BYTES;
                byte[] previewBytes = truncated ? java.util.Arrays.copyOf(bytes, MAX_FILE_CONTENT_BYTES) : bytes;
                String contentType = response.headers() == null ? null : response.headers().get("Content-Type");
                boolean viewable = isTextContent(previewBytes, contentType, normalizedPath);
                String content = viewable ? formatContent(previewBytes, contentType, normalizedPath) : null;
                return PaimonTableFileContentResponse.builder()
                        .databaseName(normalizedDatabase)
                        .tableName(normalizedTable)
                        .tablePath(tablePath)
                        .path(normalizedPath)
                        .name(fileName(normalizedPath))
                        .contentType(contentType)
                        .size(response.headers() == null ? null : parseLong(response.headers().get("Content-Length")))
                        .truncated(truncated)
                        .viewable(viewable)
                        .content(content)
                        .message(viewable ? "ok" : "当前文件不是可直接预览的文本文件")
                        .build();
            }
        } catch (Exception e) {
            throw paimonApiException("读取 Paimon Table 文件内容失败", e);
        }
    }

    private PaimonTableFileContentResponse readDataManifestContent(Long catalogId, String databaseName, String tableName, String path) throws Exception {
        String tablePath = resolveTablePath(catalogId, databaseName, tableName);
        try (Catalog catalog = createPaimonCatalog(catalogId)) {
            Table table = catalog.getTable(Identifier.create(databaseName, tableName));
            if (!(table instanceof FileStoreTable fileStoreTable)) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "当前 Paimon 表类型暂不支持解析 manifest");
            }
            String manifestName = fileName(path);
            List<ManifestEntry> entries = fileStoreTable.store().manifestFileFactory().create().read(
                    manifestName,
                    null,
                    null,
                    null,
                    row -> true,
                    entry -> true
            );
            List<String> columns = List.of(
                    "kind",
                    "partition",
                    "bucket",
                    "level",
                    "file_name",
                    "file_size",
                    "row_count",
                    "schema_id",
                    "min_sequence_number",
                    "max_sequence_number",
                    "external_path",
                    "extra_files"
            );
            List<Map<String, Object>> rows = entries.stream()
                    .limit(MAX_FILE_ENTRIES)
                    .map(this::toManifestRow)
                    .toList();
            return PaimonTableFileContentResponse.builder()
                    .databaseName(databaseName)
                    .tableName(tableName)
                    .tablePath(tablePath)
                    .path(path)
                    .name(manifestName)
                    .contentType("application/x-paimon-manifest")
                    .size(null)
                    .truncated(entries.size() > MAX_FILE_ENTRIES)
                    .viewable(true)
                    .columns(columns)
                    .rows(rows)
                    .message("manifest")
                    .build();
        }
    }

    private PaimonTableFileContentResponse readIndexManifestContent(Long catalogId, String databaseName, String tableName, String path) throws Exception {
        String tablePath = resolveTablePath(catalogId, databaseName, tableName);
        try (Catalog catalog = createPaimonCatalog(catalogId)) {
            Table table = catalog.getTable(Identifier.create(databaseName, tableName));
            if (!(table instanceof FileStoreTable fileStoreTable)) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "当前 Paimon 表类型暂不支持解析 index manifest");
            }
            String manifestName = fileName(path);
            List<IndexManifestEntry> entries = fileStoreTable.store().indexManifestFileFactory().create().read(
                    manifestName,
                    null,
                    row -> true,
                    entry -> true
            );
            List<String> columns = List.of(
                    "kind",
                    "partition",
                    "bucket",
                    "index_type",
                    "file_name",
                    "file_size",
                    "row_count",
                    "external_path",
                    "dv_ranges"
            );
            List<Map<String, Object>> rows = entries.stream()
                    .limit(MAX_FILE_ENTRIES)
                    .map(this::toIndexManifestRow)
                    .toList();
            return PaimonTableFileContentResponse.builder()
                    .databaseName(databaseName)
                    .tableName(tableName)
                    .tablePath(tablePath)
                    .path(path)
                    .name(manifestName)
                    .contentType("application/x-paimon-index-manifest")
                    .size(null)
                    .truncated(entries.size() > MAX_FILE_ENTRIES)
                    .viewable(true)
                    .columns(columns)
                    .rows(rows)
                    .message("index-manifest")
                    .build();
        }
    }

    private PaimonTableFileContentResponse readIndexFileContent(Long catalogId, String databaseName, String tableName, String path) throws Exception {
        String tablePath = resolveTablePath(catalogId, databaseName, tableName);
        try (Catalog catalog = createPaimonCatalog(catalogId)) {
            Table table = catalog.getTable(Identifier.create(databaseName, tableName));
            if (!(table instanceof FileStoreTable fileStoreTable)) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "当前 Paimon 表类型暂不支持解析 index 文件");
            }
            String indexFileName = fileName(path);
            IndexManifestEntry matchedEntry = fileStoreTable.store().newIndexFileHandler().scanEntries().stream()
                    .filter(entry -> entry.indexFile() != null && indexFileName.equals(entry.indexFile().fileName()))
                    .findFirst()
                    .orElseThrow(() -> new BusinessException(ResultCode.NOT_FOUND.getCode(), "未找到 index 文件元数据: " + indexFileName));
            IndexFileMeta indexFile = matchedEntry.indexFile();
            List<String> columns = List.of("position");
            List<Map<String, Object>> rows = List.of();
            String message = "当前 index 类型暂不支持结构化解析: " + indexFile.indexType();
            if ("HASH".equalsIgnoreCase(indexFile.indexType())) {
                rows = fileStoreTable.store()
                        .newIndexFileHandler()
                        .hashIndex(matchedEntry.partition(), matchedEntry.bucket())
                        .readList(indexFile)
                        .stream()
                        .limit(MAX_FILE_ENTRIES)
                        .map(value -> {
                            Map<String, Object> row = new LinkedHashMap<>();
                            row.put("position", value);
                            return row;
                        })
                        .toList();
                message = "hash-index";
            }
            return PaimonTableFileContentResponse.builder()
                    .databaseName(databaseName)
                    .tableName(tableName)
                    .tablePath(tablePath)
                    .path(path)
                    .name(indexFileName)
                    .contentType("application/x-paimon-index")
                    .size(indexFile.fileSize())
                    .truncated(rows.size() >= MAX_FILE_ENTRIES && indexFile.rowCount() > MAX_FILE_ENTRIES)
                    .viewable(true)
                    .columns(columns)
                    .rows(rows)
                    .message(message)
                    .build();
        }
    }

    public PaimonTableSnapshotsResponse listTableSnapshots(Long catalogId, String databaseName, String tableName) {
        String normalizedDatabase = requireIdentifier(databaseName, "databaseName");
        String normalizedTable = requireIdentifier(tableName, "tableName");
        try {
            Identifier identifier = Identifier.create(normalizedDatabase, normalizedTable);
            List<Snapshot> snapshots;
            try (Catalog catalog = createPaimonCatalog(catalogId)) {
                Table table = catalog.getTable(identifier);
                snapshots = readTableSnapshots(catalog, identifier, table);
            }
            List<String> columns = List.of(
                    "snapshot_id",
                    "schema_id",
                    "commit_user",
                    "commit_identifier",
                    "commit_kind",
                    "commit_time",
                    "total_record_count",
                    "delta_record_count",
                    "changelog_record_count",
                    "watermark",
                    "next_row_id"
            );
            List<Map<String, Object>> rows = snapshots.stream()
                    .sorted(Comparator.comparingLong(Snapshot::id).reversed())
                    .limit(50)
                    .map(this::toSnapshotRow)
                    .toList();
            return PaimonTableSnapshotsResponse.builder()
                    .databaseName(normalizedDatabase)
                    .tableName(normalizedTable)
                    .columns(columns)
                    .rows(rows)
                    .message(rows.isEmpty() ? "暂无快照" : "ok")
                    .build();
        } catch (Exception e) {
            log.warn("Failed to read Paimon snapshots: catalogId={}, table={}.{}, errorType={}, error={}",
                    catalogId, normalizedDatabase, normalizedTable, e.getClass().getName(), e.getMessage(), e);
            return PaimonTableSnapshotsResponse.builder()
                    .databaseName(normalizedDatabase)
                    .tableName(normalizedTable)
                    .columns(List.of())
                    .rows(List.of())
                    .message("当前 Paimon/Flink 运行时暂不支持通过系统表读取快照，或该表暂无快照。")
                    .build();
        }
    }

    private Catalog createPaimonCatalog(Long catalogId) {
        PaimonCatalog catalog = paimonCatalogService.getRequiredRuntimeCatalog(catalogId);
        Options options = new Options();
        paimonCatalogService.readRuntimeOptions(catalog).forEach(options::set);
        options.set("warehouse", catalog.getWarehouse());
        if (catalog.getMetastoreType() != null && !catalog.getMetastoreType().isBlank()) {
            options.set("metastore", catalog.getMetastoreType().trim());
        }
        return CatalogFactory.createCatalog(CatalogContext.create(options, new Configuration(false)));
    }

    private List<Snapshot> readTableSnapshots(Catalog catalog, Identifier identifier, Table table) throws Exception {
        if (table instanceof FileStoreTable fileStoreTable) {
            return fileStoreTable.store().snapshotManager().safelyGetAllSnapshots();
        }
        PagedList<Snapshot> snapshotPage = catalog.listSnapshotsPaged(identifier, 50, null);
        if (snapshotPage == null || snapshotPage.getElements() == null) {
            return List.of();
        }
        return snapshotPage.getElements();
    }

    private String resolveTablePath(Long catalogId, String databaseName, String tableName) throws Exception {
        try (Catalog catalog = createPaimonCatalog(catalogId)) {
            Table table = catalog.getTable(Identifier.create(databaseName, tableName));
            if (table instanceof FileStoreTable fileStoreTable) {
                String path = stringValue(fileStoreTable.options().get("path"));
                if (path != null && !path.isBlank()) {
                    return path;
                }
            }
        }
        PaimonCatalog catalogConfig = paimonCatalogService.getRequiredRuntimeCatalog(catalogId);
        String warehouse = catalogConfig.getWarehouse();
        if (warehouse == null || warehouse.isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Paimon Catalog 未配置 Warehouse");
        }
        return ensureNoTrailingSlash(warehouse) + "/" + databaseName + ".db/" + tableName;
    }

    private S3Location parseS3Location(String tablePath) {
        URI uri = URI.create(tablePath);
        if (!"s3".equalsIgnoreCase(uri.getScheme())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "当前文件浏览仅支持 s3:// Paimon 表路径");
        }
        String bucket = uri.getHost();
        String prefix = uri.getPath() == null ? "" : uri.getPath().replaceFirst("^/", "");
        if (bucket == null || bucket.isBlank() || prefix.isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Paimon 表 S3 路径不合法: " + tablePath);
        }
        return new S3Location(bucket, prefix);
    }

    private MinioClient createS3Client(PaimonCatalog catalog) {
        PaimonCatalogService.S3RuntimeConfig s3Config = paimonCatalogService.readS3RuntimeConfig(catalog);
        return MinioClient.builder()
                .endpoint(s3Config.endpoint())
                .credentials(s3Config.accessKey(), s3Config.secretKey())
                .build();
    }

    private String normalizeRelativePath(String path) {
        if (path == null || path.isBlank()) {
            return "";
        }
        String normalized = path.trim().replace("\\", "/").replaceAll("/+", "/");
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        if (normalized.contains("..")) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "文件路径不允许包含 ..");
        }
        return ensureTrailingSlash(normalized);
    }

    private String normalizeFilePath(String path) {
        if (path == null || path.isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "文件路径不能为空");
        }
        String normalized = path.trim().replace("\\", "/").replaceAll("/+", "/");
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        if (normalized.contains("..") || normalized.endsWith("/")) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "文件路径不合法");
        }
        return normalized;
    }

    private boolean isDataManifestPath(String path) {
        String name = fileName(path);
        return path.startsWith("manifest/")
                && name.startsWith("manifest-")
                && !name.startsWith("manifest-list-")
                && !name.startsWith("index-manifest-");
    }

    private boolean isIndexManifestPath(String path) {
        String name = fileName(path);
        return path.startsWith("manifest/") && name.startsWith("index-manifest-");
    }

    private boolean isIndexFilePath(String path) {
        return path.startsWith("index/") && fileName(path).startsWith("index-");
    }

    private Map<String, Object> toManifestRow(ManifestEntry entry) {
        DataFileMeta file = entry.file();
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("kind", entry.kind() == null ? null : entry.kind().name());
        row.put("partition", entry.partition() == null || entry.partition().getFieldCount() == 0 ? "" : entry.partition().toString());
        row.put("bucket", entry.bucket());
        row.put("level", entry.level());
        row.put("file_name", entry.fileName());
        row.put("file_size", file == null ? null : file.fileSize());
        row.put("row_count", entry.rowCount());
        row.put("schema_id", file == null ? null : file.schemaId());
        row.put("min_sequence_number", file == null ? null : file.minSequenceNumber());
        row.put("max_sequence_number", file == null ? null : file.maxSequenceNumber());
        row.put("external_path", entry.externalPath());
        row.put("extra_files", entry.extraFiles());
        return row;
    }

    private Map<String, Object> toIndexManifestRow(IndexManifestEntry entry) {
        IndexFileMeta file = entry.indexFile();
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("kind", entry.kind() == null ? null : entry.kind().name());
        row.put("partition", entry.partition() == null || entry.partition().getFieldCount() == 0 ? "" : entry.partition().toString());
        row.put("bucket", entry.bucket());
        row.put("index_type", file == null ? null : file.indexType());
        row.put("file_name", file == null ? null : file.fileName());
        row.put("file_size", file == null ? null : file.fileSize());
        row.put("row_count", file == null ? null : file.rowCount());
        row.put("external_path", file == null ? null : file.externalPath());
        row.put("dv_ranges", file == null ? null : file.dvRanges());
        return row;
    }

    private byte[] readPreviewBytes(GetObjectResponse response) throws java.io.IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int maxBytes = MAX_FILE_CONTENT_BYTES + 1;
        int total = 0;
        int read;
        while ((read = response.read(buffer)) >= 0) {
            int allowed = Math.min(read, maxBytes - total);
            if (allowed > 0) {
                output.write(buffer, 0, allowed);
                total += allowed;
            }
            if (total >= maxBytes) {
                break;
            }
        }
        return output.toByteArray();
    }

    private boolean isTextContent(byte[] bytes, String contentType, String path) {
        String lowerType = contentType == null ? "" : contentType.toLowerCase();
        String lowerPath = path.toLowerCase();
        if (lowerType.startsWith("text/") || lowerType.contains("json") || lowerType.contains("xml")) {
            return true;
        }
        if (lowerPath.endsWith(".json") || lowerPath.endsWith(".txt") || lowerPath.endsWith(".csv")
                || lowerPath.endsWith(".log") || lowerPath.endsWith(".yaml") || lowerPath.endsWith(".yml")) {
            return true;
        }
        for (byte value : bytes) {
            int unsigned = value & 0xFF;
            if (unsigned == 0) {
                return false;
            }
            if (unsigned < 9 || (unsigned > 13 && unsigned < 32)) {
                return false;
            }
        }
        return true;
    }

    private String formatContent(byte[] bytes, String contentType, String path) {
        String content = new String(bytes, StandardCharsets.UTF_8);
        String lowerType = contentType == null ? "" : contentType.toLowerCase();
        String lowerPath = path.toLowerCase();
        if (lowerType.contains("json") || lowerPath.endsWith(".json") || looksLikeJson(content)) {
            try {
                JsonNode node = objectMapper.readTree(content);
                return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(node);
            } catch (Exception ignored) {
                return content;
            }
        }
        return content;
    }

    private boolean looksLikeJson(String content) {
        String trimmed = content == null ? "" : content.trim();
        return (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"));
    }

    private PaimonTableFilesResponse.Entry toFileEntry(Item item, String relativePath) {
        boolean directory = item.isDir() || relativePath.endsWith("/");
        String normalizedPath = directory ? ensureTrailingSlash(relativePath) : relativePath;
        String name = fileName(normalizedPath);
        OffsetDateTime lastModified = item.lastModified() == null ? null : item.lastModified().toOffsetDateTime();
        return PaimonTableFilesResponse.Entry.builder()
                .name(name)
                .path(normalizedPath)
                .type(directory ? "directory" : "file")
                .size(directory ? null : item.size())
                .lastModified(lastModified)
                .build();
    }

    private String relativizeObjectName(String basePrefix, String objectName) {
        if (objectName == null || !objectName.startsWith(basePrefix)) {
            return "";
        }
        return objectName.substring(basePrefix.length());
    }

    private String parentPath(String path) {
        if (path == null || path.isBlank()) {
            return "";
        }
        String normalized = path.endsWith("/") ? path.substring(0, path.length() - 1) : path;
        int slash = normalized.lastIndexOf('/');
        return slash < 0 ? "" : normalized.substring(0, slash + 1);
    }

    private String fileName(String path) {
        String normalized = path.endsWith("/") ? path.substring(0, path.length() - 1) : path;
        int slash = normalized.lastIndexOf('/');
        return slash < 0 ? normalized : normalized.substring(slash + 1);
    }

    private String ensureTrailingSlash(String value) {
        return value == null || value.isBlank() || value.endsWith("/") ? firstNonBlank(value, "") : value + "/";
    }

    private String ensureNoTrailingSlash(String value) {
        String normalized = value;
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private TableSchema resolveTableSchema(Table table) {
        if (table instanceof FileStoreTable fileStoreTable) {
            return fileStoreTable.schema();
        }
        throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "当前 Paimon 表类型暂不支持读取 Schema");
    }

    private PaimonTableSchemaResponse.Column toSchemaColumn(DataField field, TableSchema schema) {
        String name = field.name();
        return PaimonTableSchemaResponse.Column.builder()
                .name(name)
                .type(field.type().asSQLString())
                .nullable(String.valueOf(field.type().isNullable()))
                .key(schema.primaryKeys().contains(name) ? "PRI" : "")
                .extras(field.defaultValue() == null || field.defaultValue().isBlank() ? field.description() : "DEFAULT " + field.defaultValue())
                .watermark("")
                .build();
    }

    private String buildCreateTableSql(String databaseName, String tableName, TableSchema schema, Map<String, String> options) {
        StringBuilder sql = new StringBuilder("CREATE TABLE ");
        sql.append(tableIdentifier(databaseName, tableName)).append(" (\n");
        List<String> definitions = new ArrayList<>();
        for (DataField field : schema.fields()) {
            StringBuilder column = new StringBuilder("  ");
            column.append(quoteIdentifier(field.name())).append(" ").append(field.type().asSQLString());
            if (field.defaultValue() != null && !field.defaultValue().isBlank()) {
                column.append(" DEFAULT ").append(field.defaultValue());
            }
            if (field.description() != null && !field.description().isBlank()) {
                column.append(" COMMENT '").append(escapeSqlLiteral(field.description())).append("'");
            }
            definitions.add(column.toString());
        }
        if (!schema.primaryKeys().isEmpty()) {
            definitions.add("  PRIMARY KEY (" + joinIdentifiers(schema.primaryKeys()) + ") NOT ENFORCED");
        }
        sql.append(String.join(",\n", definitions)).append("\n)");
        if (schema.comment() != null && !schema.comment().isBlank()) {
            sql.append("\nCOMMENT '").append(escapeSqlLiteral(schema.comment())).append("'");
        }
        if (!schema.partitionKeys().isEmpty()) {
            sql.append("\nPARTITIONED BY (").append(joinIdentifiers(schema.partitionKeys())).append(")");
        }
        if (!options.isEmpty()) {
            sql.append("\nWITH (\n");
            int index = 0;
            for (Map.Entry<String, String> entry : options.entrySet()) {
                sql.append("  '").append(escapeSqlLiteral(entry.getKey())).append("' = '")
                        .append(escapeSqlLiteral(entry.getValue())).append("'");
                if (++index < options.size()) {
                    sql.append(",");
                }
                sql.append("\n");
            }
            sql.append(")");
        }
        sql.append(";");
        return sql.toString();
    }

    private String joinIdentifiers(List<String> identifiers) {
        return String.join(", ", identifiers.stream().map(this::quoteIdentifier).toList());
    }

    private Map<String, Object> toSnapshotRow(Snapshot snapshot) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("snapshot_id", snapshot.id());
        row.put("schema_id", snapshot.schemaId());
        row.put("commit_user", snapshot.commitUser());
        row.put("commit_identifier", snapshot.commitIdentifier());
        row.put("commit_kind", snapshot.commitKind() == null ? null : snapshot.commitKind().name());
        row.put("commit_time", snapshot.timeMillis());
        row.put("total_record_count", snapshot.totalRecordCount());
        row.put("delta_record_count", snapshot.deltaRecordCount());
        row.put("changelog_record_count", snapshot.changelogRecordCount());
        row.put("watermark", snapshot.watermark());
        row.put("next_row_id", snapshot.nextRowId());
        return row;
    }

    private BusinessException paimonApiException(String message, Exception e) {
        if (e instanceof BusinessException businessException) {
            return businessException;
        }
        return new BusinessException(ResultCode.BAD_REQUEST.getCode(), message + ": " + e.getMessage());
    }

    public PaimonTablePreviewResponse previewTable(Long catalogId, String databaseName, String tableName, Integer limit) {
        String normalizedDatabase = requireIdentifier(databaseName, "databaseName");
        String normalizedTable = requireIdentifier(tableName, "tableName");
        int normalizedLimit = normalizeLimit(limit);
        QueryResult result = executeCatalogPreviewQuery(
                catalogId,
                "SELECT * FROM " + tableIdentifier(normalizedDatabase, normalizedTable) + " LIMIT " + normalizedLimit,
                normalizedLimit
        );
        return PaimonTablePreviewResponse.builder()
                .databaseName(normalizedDatabase)
                .tableName(normalizedTable)
                .columns(result.columns().stream()
                        .map(column -> new PaimonTablePreviewResponse.Column(column.name(), column.type()))
                        .toList())
                .data(result.rows())
                .truncated(result.truncated())
                .build();
    }

    @SuppressWarnings("unchecked")
    private <T> T cached(String key, boolean refresh, CacheSupplier<T> supplier) {
        CacheEntry<?> existing = cache.get(key);
        long now = System.currentTimeMillis();
        if (!refresh && existing != null && existing.expiresAt() > now) {
            return (T) existing.value();
        }
        T value = supplier.get();
        if (isEmptyCacheValue(value)) {
            cache.remove(key);
            return value;
        }
        cache.put(key, new CacheEntry<>(value, now + Math.max(cacheTtlMs, 1000)));
        return value;
    }

    private boolean isEmptyCacheValue(Object value) {
        return value instanceof java.util.Collection<?> collection && collection.isEmpty();
    }

    private QueryResult executeCatalogPreviewQuery(Long catalogId, String sql, int maxRows) {
        PaimonCatalog catalog = paimonCatalogService.getRequiredRuntimeCatalog(catalogId);
        FlinkCluster cluster = resolveGatewayRuntime();
        if (cluster.getGatewayAddress() == null || cluster.getGatewayAddress().isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "内置运行时未配置 SQL Gateway 地址");
        }
        FlinkSqlGatewayClient client = createGatewayClient(cluster);
        String sessionHandle = client.openSession("rayflow-paimon-preview-" + System.currentTimeMillis());
        String operationHandle = null;
        boolean completed = false;
        try {
            List<String> statements = buildSessionStatements(catalog, sql);
            for (int i = 0; i < statements.size(); i++) {
                operationHandle = client.executeStatement(sessionHandle, statements.get(i));
                boolean lastStatement = i == statements.size() - 1;
                if (lastStatement) {
                    waitOperationReadable(client, sessionHandle, operationHandle);
                } else {
                    waitOperationFinished(client, sessionHandle, operationHandle);
                }
            }
            if (operationHandle == null) {
                completed = true;
                return new QueryResult(List.of(), List.of(), false);
            }
            QueryResult result = collectResult(client, sessionHandle, operationHandle, maxRows);
            completed = true;
            return result;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Paimon 预览查询失败: " + e.getMessage());
        } finally {
            if (!completed && operationHandle != null) {
                client.cancelOperation(sessionHandle, operationHandle);
            }
            client.closeSession(sessionHandle);
        }
    }

    private FlinkSqlGatewayClient createGatewayClient(FlinkCluster cluster) {
        int browserReadTimeoutMs = Math.max(readTimeoutMs, (int) Math.min(operationTimeoutMs + 5000, 120000));
        return new FlinkSqlGatewayClient(cluster.getGatewayAddress(), connectTimeoutMs, browserReadTimeoutMs);
    }

    private FlinkCluster resolveGatewayRuntime() {
        try {
            return flinkClusterService.getRequiredGlobalByName(BUILTIN_RUNTIME_NAME);
        } catch (BusinessException e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "未找到 Paimon 浏览专用内置运行时: " + BUILTIN_RUNTIME_NAME);
        }
    }

    private List<String> buildSessionStatements(PaimonCatalog catalog, String sql) {
        List<String> statements = new ArrayList<>();
        statements.add(buildCreateCatalogSql(catalog));
        statements.add("USE CATALOG " + quoteIdentifier(catalog.getCatalogName()));
        statements.add("SET 'execution.runtime-mode' = 'batch'");
        for (String statement : sql.split(";")) {
            String trimmed = statement.trim();
            if (!trimmed.isEmpty()) {
                statements.add(trimmed);
            }
        }
        return statements;
    }

    private String buildCreateCatalogSql(PaimonCatalog catalog) {
        Map<String, String> options = new LinkedHashMap<>(paimonCatalogService.readRuntimeOptions(catalog));
        options.put("type", "paimon");
        options.put("warehouse", catalog.getWarehouse());
        if (catalog.getMetastoreType() != null && !catalog.getMetastoreType().isBlank()) {
            options.put("metastore", catalog.getMetastoreType().trim());
        }

        StringBuilder sql = new StringBuilder("CREATE CATALOG ");
        sql.append(quoteIdentifier(catalog.getCatalogName())).append(" WITH (\n");
        int index = 0;
        for (Map.Entry<String, String> entry : options.entrySet()) {
            if (entry.getValue() == null || entry.getValue().isBlank()) {
                continue;
            }
            if (index > 0) {
                sql.append(",\n");
            }
            sql.append("  '").append(escapeSqlLiteral(entry.getKey())).append("' = '")
                    .append(escapeSqlLiteral(entry.getValue())).append("'");
            index++;
        }
        sql.append("\n)");
        return sql.toString();
    }

    private void waitOperationFinished(FlinkSqlGatewayClient client, String sessionHandle, String operationHandle) {
        long deadline = System.currentTimeMillis() + operationTimeoutMs;
        String status = "PENDING";
        while (System.currentTimeMillis() < deadline) {
            status = client.getOperationStatus(sessionHandle, operationHandle);
            if ("FINISHED".equalsIgnoreCase(status)) {
                return;
            }
            if ("ERROR".equalsIgnoreCase(status) || "CANCELED".equalsIgnoreCase(status)
                    || "TIMEOUT".equalsIgnoreCase(status) || "CLOSED".equalsIgnoreCase(status)) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Paimon 浏览查询执行失败，状态为: " + status);
            }
            sleepQuietly(300);
        }
        throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "等待 Paimon 浏览查询超时，当前状态为: " + status);
    }

    private void waitOperationReadable(FlinkSqlGatewayClient client, String sessionHandle, String operationHandle) {
        long deadline = System.currentTimeMillis() + operationTimeoutMs;
        String status = "PENDING";
        while (System.currentTimeMillis() < deadline) {
            status = client.getOperationStatus(sessionHandle, operationHandle);
            if ("RUNNING".equalsIgnoreCase(status) || "FINISHED".equalsIgnoreCase(status)) {
                return;
            }
            if ("ERROR".equalsIgnoreCase(status) || "CANCELED".equalsIgnoreCase(status)
                    || "TIMEOUT".equalsIgnoreCase(status) || "CLOSED".equalsIgnoreCase(status)) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Paimon 预览查询执行失败，状态为: " + status);
            }
            sleepQuietly(300);
        }
        throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "等待 Paimon 预览查询可读超时，当前状态为: " + status);
    }

    @SuppressWarnings("unchecked")
    private QueryResult collectResult(FlinkSqlGatewayClient client, String sessionHandle, String operationHandle, int maxRows) {
        List<QueryColumn> columns = new ArrayList<>();
        List<Map<String, Object>> rows = new ArrayList<>();
        boolean truncated = false;
        String token = "0";
        long deadline = System.currentTimeMillis() + operationTimeoutMs;
        while (token != null && !token.isBlank()) {
            Map<String, Object> page = client.getExecutionResult(sessionHandle, operationHandle, token);
            if (columns.isEmpty()) {
                columns.addAll(parseColumns(page));
            }
            Map<String, Object> results = page == null ? null : (Map<String, Object>) page.get("results");
            Object dataObj = results == null ? null : results.get("data");
            int rowCountBeforePage = rows.size();
            if (dataObj instanceof List<?> data) {
                for (Object item : data) {
                    if (rows.size() >= maxRows) {
                        truncated = true;
                        break;
                    }
                    rows.add(parseRow(item, columns));
                }
            }
            if (truncated) {
                break;
            }
            String nextToken = extractNextResultToken(page);
            if (nextToken != null && !nextToken.isBlank() && !nextToken.equals(token)) {
                token = nextToken;
                continue;
            }
            String status = client.getOperationStatus(sessionHandle, operationHandle);
            if ("FINISHED".equalsIgnoreCase(status)) {
                break;
            }
            if ("ERROR".equalsIgnoreCase(status) || "CANCELED".equalsIgnoreCase(status)
                    || "TIMEOUT".equalsIgnoreCase(status) || "CLOSED".equalsIgnoreCase(status)) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Paimon 浏览结果读取失败，状态为: " + status);
            }
            if (System.currentTimeMillis() >= deadline) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "等待 Paimon 浏览结果超时，当前状态为: " + status);
            }
            if (rows.size() == rowCountBeforePage) {
                sleepQuietly(300);
            }
        }
        return new QueryResult(columns, rows, truncated);
    }

    @SuppressWarnings("unchecked")
    private List<QueryColumn> parseColumns(Map<String, Object> page) {
        List<QueryColumn> columns = new ArrayList<>();
        if (page == null) {
            return columns;
        }
        Object resultSchemaObj = page.get("resultSchema");
        if (resultSchemaObj instanceof Map<?, ?> resultSchema) {
            Object columnsObj = resultSchema.get("columns");
            if (columnsObj instanceof List<?> resultColumns) {
                for (Object item : resultColumns) {
                    if (item instanceof Map<?, ?> column) {
                        columns.add(new QueryColumn(
                                stringValue(column.get("name")),
                                firstNonBlank(stringValue(column.get("logicalType")), stringValue(column.get("type")), "STRING")
                        ));
                    }
                }
            }
        }
        if (!columns.isEmpty()) {
            return columns;
        }
        Map<String, Object> results = (Map<String, Object>) page.get("results");
        Object resultColumnsObj = results == null ? null : results.get("columns");
        if (resultColumnsObj instanceof List<?> resultColumns) {
            for (Object item : resultColumns) {
                if (item instanceof Map<?, ?> column) {
                    columns.add(new QueryColumn(
                            stringValue(column.get("name")),
                            firstNonBlank(extractColumnType(column.get("logicalType")), stringValue(column.get("type")), "STRING")
                    ));
                }
            }
        }
        return columns;
    }

    private String extractColumnType(Object logicalType) {
        if (logicalType == null) {
            return null;
        }
        if (logicalType instanceof Map<?, ?> logicalTypeMap) {
            Object type = logicalTypeMap.get("type");
            return type == null ? logicalTypeMap.toString() : String.valueOf(type);
        }
        return String.valueOf(logicalType);
    }

    private Map<String, Object> parseRow(Object item, List<QueryColumn> columns) {
        List<?> fields = null;
        if (item instanceof Map<?, ?> rowMap) {
            Object fieldsObj = rowMap.get("fields");
            if (fieldsObj instanceof List<?> fieldList) {
                fields = fieldList;
            }
        } else if (item instanceof List<?> fieldList) {
            fields = fieldList;
        }
        Map<String, Object> row = new LinkedHashMap<>();
        if (fields == null) {
            row.put("value", normalizeValue(item));
            return row;
        }
        for (int i = 0; i < fields.size(); i++) {
            String name = i < columns.size() && columns.get(i).name() != null && !columns.get(i).name().isBlank()
                    ? columns.get(i).name()
                    : "column_" + (i + 1);
            row.put(name, normalizeValue(fields.get(i)));
        }
        return row;
    }

    private Object normalizeValue(Object value) {
        if (value == null || value instanceof Number || value instanceof Boolean || value instanceof CharSequence) {
            return value;
        }
        return String.valueOf(value);
    }

    private String extractNextResultToken(Map<String, Object> page) {
        if (page == null) {
            return null;
        }
        Object nextToken = page.get("nextResultUri");
        if (nextToken instanceof String uri && !uri.isBlank()) {
            int slash = uri.lastIndexOf('/');
            return slash >= 0 ? uri.substring(slash + 1) : uri;
        }
        Object token = page.get("nextToken");
        return token == null ? null : String.valueOf(token);
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return DEFAULT_PREVIEW_LIMIT;
        }
        return Math.min(limit, MAX_PREVIEW_LIMIT);
    }

    private String requireIdentifier(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), fieldName + " 不能为空");
        }
        return value.trim();
    }

    private String tableIdentifier(String databaseName, String tableName) {
        return quoteIdentifier(databaseName) + "." + quoteIdentifier(tableName);
    }

    private String quoteIdentifier(String value) {
        return "`" + value.replace("`", "``") + "`";
    }

    private String escapeSqlLiteral(String value) {
        return value == null ? "" : value.replace("'", "''");
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private Long parseLong(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private interface CacheSupplier<T> {
        T get();
    }

    private record CacheEntry<T>(T value, long expiresAt) {}

    private record QueryColumn(String name, String type) {}

    private record QueryResult(List<QueryColumn> columns, List<Map<String, Object>> rows, boolean truncated) {}

    private record S3Location(String bucket, String prefix) {}
}
