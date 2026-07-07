package com.rayflow.server.service.submit;

import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.File;
import java.util.Comparator;
import java.util.stream.Stream;

@Component
public class SqlRunnerJarResolver {

    @Value("${rayflow.flink.sql-runner-jar:}")
    private String sqlRunnerJarPath;

    public File resolve() {
        File configured = isBlank(sqlRunnerJarPath) ? null : new File(sqlRunnerJarPath.trim());
        if (configured != null && configured.exists() && configured.isFile()) {
            return configured;
        }

        String userDir = System.getProperty("user.dir", ".");
        for (File candidate : candidateFiles(userDir)) {
            if (candidate.exists() && candidate.isFile()) {
                return candidate;
            }
        }

        String message = "SQL Runner JAR 不存在，请先构建 backend/rayflow-flink-sql-runner，或配置 rayflow.flink.sql-runner-jar";
        if (configured != null) {
            message += ": " + configured.getAbsolutePath();
        }
        throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), message);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static File[] candidateFiles(String userDir) {
        File packaged = new File("/app/rayflow-flink-sql-runner.jar");
        return Stream.of(
                        packaged,
                        newestRunnerJar(new File(userDir, "../rayflow-flink-sql-runner/target")),
                        newestRunnerJar(new File(userDir, "rayflow-flink-sql-runner/target")),
                        newestRunnerJar(new File(userDir, "backend/rayflow-flink-sql-runner/target"))
                )
                .filter(file -> file != null)
                .toArray(File[]::new);
    }

    private static File newestRunnerJar(File targetDir) {
        File[] jars = targetDir.listFiles(file -> file.isFile()
                && file.getName().startsWith("rayflow-flink-sql-runner-")
                && file.getName().endsWith(".jar")
                && !file.getName().endsWith("-sources.jar")
                && !file.getName().endsWith("-javadoc.jar"));
        if (jars == null || jars.length == 0) {
            return null;
        }
        return Stream.of(jars)
                .max(Comparator.comparingLong(File::lastModified))
                .orElse(null);
    }
}
