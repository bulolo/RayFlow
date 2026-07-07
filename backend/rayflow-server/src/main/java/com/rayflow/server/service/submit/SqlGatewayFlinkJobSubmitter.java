package com.rayflow.server.service.submit;

import com.rayflow.flink.client.FlinkSqlGatewayClient;
import com.rayflow.flink.client.FlinkErrorParser;
import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import com.rayflow.server.model.entity.FlinkCluster;
import com.rayflow.server.model.entity.FlinkJob;
import com.rayflow.server.service.FlinkJarResourceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Slf4j
@Component
@RequiredArgsConstructor
public class SqlGatewayFlinkJobSubmitter implements FlinkJobSubmitter {

    private final FlinkJarResourceService flinkJarResourceService;

    @Value("${rayflow.flink.rest-connect-timeout-ms:3000}")
    private int connectTimeoutMs;

    @Value("${rayflow.flink.rest-read-timeout-ms:120000}")
    private int readTimeoutMs;

    @Override
    public String submit(FlinkJob job, FlinkCluster cluster) {
        if (cluster.getGatewayAddress() == null || cluster.getGatewayAddress().isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "该运行时未配置 SQL Gateway 地址，无法使用 SQL_GATEWAY 提交方式");
        }
        if (!"SQL".equalsIgnoreCase(job.getJobType())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "SQL Gateway 提交方式仅支持 SQL 类型的作业");
        }
        if (job.getContent() == null || job.getContent().isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "SQL 作业内容不能为空");
        }

        FlinkSqlGatewayClient client = new FlinkSqlGatewayClient(cluster.getGatewayAddress(), connectTimeoutMs, readTimeoutMs);
        String sessionHandle = client.openSession("rayflow-submit-session-" + job.getId());
        try {
            executeDependencyJars(client, sessionHandle, job);
            executePipelineNameSet(client, sessionHandle, job.getJobName());
            FlinkSqlStatementInspector.SqlAnalysis sqlAnalysis = FlinkSqlStatementInspector.analyze(job.getContent());
            List<String> ddlOrSetStatements = new ArrayList<>();
            List<String> insertStatements = new ArrayList<>();

            for (String cleanStmt : sqlAnalysis.statements()) {
                String upper = cleanStmt.toUpperCase(Locale.ROOT);
                if (upper.startsWith("INSERT ")) {
                    insertStatements.add(cleanStmt);
                } else {
                    ddlOrSetStatements.add(cleanStmt);
                }
            }

            // 1. 依次同步执行 DDL / SET 等前置语句
            for (String ddlStmt : ddlOrSetStatements) {
                log.info("SQL Gateway Submitter: executing pre-statement, jobId={}, type={}", job.getId(), statementType(ddlStmt));
                String opHandle = client.executeStatement(sessionHandle, ddlStmt);
                waitOperationFinished(client, sessionHandle, opHandle, 30000); // 前置配置/DDL 等待30秒
            }

            // 2. 构造并执行 DML (INSERT) 语句
            if (insertStatements.isEmpty()) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "SQL Gateway 物理提交暂仅支持包含 INSERT INTO 的 SQL 作业");
            }

            String dmlSql;
            if (insertStatements.size() == 1) {
                dmlSql = insertStatements.get(0);
            } else {
                // 如果是多个 INSERT，合并为 STATEMENT SET 提交以合并运行图
                StringBuilder sb = new StringBuilder();
                sb.append("EXECUTE STATEMENT SET BEGIN\n");
                for (String insert : insertStatements) {
                    sb.append(insert).append(";\n");
                }
                sb.append("END;");
                dmlSql = sb.toString();
            }

            log.info("SQL Gateway Submitter: submitting DML statement, jobId={}, insertCount={}", job.getId(), insertStatements.size());
            String dmlOpHandle = client.executeStatement(sessionHandle, dmlSql);
            
            // 3. 轮询等待 DML 作业运行并获取生成的 Flink Job ID
            waitOperationFinished(client, sessionHandle, dmlOpHandle, 60000); // 运行拓扑生成等待60秒
            String flinkJobId = client.getExecutionJobId(sessionHandle, dmlOpHandle);
            log.info("SQL Gateway Submitter: job submitted successfully, flinkJobId={}", flinkJobId);
            return flinkJobId;

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to submit job via Flink SQL Gateway: {}", e.getMessage());
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Flink Gateway 提交失败: " + FlinkErrorParser.parse(e), e);
        } finally {
            client.closeSession(sessionHandle);
        }
    }

    private void executeDependencyJars(FlinkSqlGatewayClient client, String sessionHandle, FlinkJob job) {
        List<String> jarUris = flinkJarResourceService.resolveActiveStorageUrisForTenant(job.getDependencyRefs(), job.getTenantId());
        for (String jarUri : jarUris) {
            String statement = "ADD JAR '" + escapeSqlLiteral(jarUri) + "'";
            String opHandle = client.executeStatement(sessionHandle, statement);
            waitOperationFinished(client, sessionHandle, opHandle, 30000);
            log.info("SQL Gateway Submitter: dependency jar added to session, jobId={}, uri={}", job.getId(), jarUri);
        }
    }

    private void waitOperationFinished(FlinkSqlGatewayClient client, String sessionHandle, String opHandle, long timeoutMs) {
        long start = System.currentTimeMillis();
        String status = "RUNNING";
        while (System.currentTimeMillis() - start < timeoutMs) {
            status = client.getOperationStatus(sessionHandle, opHandle);
            if ("FINISHED".equalsIgnoreCase(status)) {
                return;
            }
            if ("ERROR".equalsIgnoreCase(status) || "CANCELED".equalsIgnoreCase(status) || "TIMEOUT".equalsIgnoreCase(status)) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "Flink SQL Gateway 语句执行失败，状态为: " + status);
            }
            try {
                Thread.sleep(1000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "任务提交流程被中断");
            }
        }
        throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "等待 Flink SQL Gateway 执行超时，当前状态为: " + status);
    }

    private void executePipelineNameSet(FlinkSqlGatewayClient client, String sessionHandle, String jobName) {
        String normalizedJobName = jobName == null || jobName.isBlank() ? "rayflow-flink-job" : jobName.trim();
        String statement = "SET 'pipeline.name' = '" + escapeSqlLiteral(normalizedJobName) + "'";
        String opHandle = client.executeStatement(sessionHandle, statement);
        waitOperationFinished(client, sessionHandle, opHandle, 30000);
    }

    private String escapeSqlLiteral(String value) {
        return value.replace("'", "''");
    }

    private static String statementType(String statement) {
        if (statement == null || statement.isBlank()) {
            return "EMPTY";
        }
        String trimmed = statement.trim();
        int end = trimmed.length();
        for (int i = 0; i < trimmed.length(); i++) {
            if (Character.isWhitespace(trimmed.charAt(i))) {
                end = i;
                break;
            }
        }
        return trimmed.substring(0, end).toUpperCase(Locale.ROOT);
    }

}
