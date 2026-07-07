package com.rayflow.server.service.submit;

import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Component
@RequiredArgsConstructor
public class S3JarResolver {

    @Value("${rayflow.artifact.s3.endpoint}")
    private String artifactEndpoint;

    @Value("${rayflow.artifact.s3.access-key}")
    private String artifactAccessKey;

    @Value("${rayflow.artifact.s3.secret-key}")
    private String artifactSecretKey;

    @Value("${rayflow.artifact.s3.region}")
    private String artifactRegion;

    @Value("${rayflow.artifact.s3.bucket}")
    private String artifactBucket;

    public Path downloadToTempFile(String s3Uri) {
        if (!StringUtils.hasText(s3Uri) || !s3Uri.trim().startsWith("s3://")) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "JAR URI 必须使用 s3://");
        }
        try {
            URI uri = URI.create(s3Uri.trim());
            String bucket = uri.getHost();
            String objectKey = uri.getPath() == null ? "" : uri.getPath().replaceFirst("^/", "");
            if (!StringUtils.hasText(bucket) || !StringUtils.hasText(objectKey)) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "JAR URI 不合法: " + s3Uri);
            }
            if (!artifactBucket.equals(bucket)) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "JAR URI 必须位于平台 Artifact Bucket: " + artifactBucket);
            }

            MinioClient client = MinioClient.builder()
                    .endpoint(artifactEndpoint)
                    .credentials(artifactAccessKey, artifactSecretKey)
                    .region(artifactRegion)
                    .build();
            String filename = objectKey.substring(objectKey.lastIndexOf('/') + 1);
            String suffix = filename.toLowerCase().endsWith(".jar") ? ".jar" : "-" + filename;
            Path tempFile = Files.createTempFile("rayflow-job-", suffix);
            try (InputStream inputStream = client.getObject(GetObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .build())) {
                Files.copy(inputStream, tempFile, StandardCopyOption.REPLACE_EXISTING);
            }
            return tempFile;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "下载 JAR 资源失败: " + e.getMessage());
        }
    }
}
