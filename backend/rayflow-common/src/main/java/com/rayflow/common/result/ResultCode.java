package com.rayflow.common.result;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 统一状态码枚举
 */
@Getter
@AllArgsConstructor
public enum ResultCode {

    SUCCESS(0, "success"),
    UNAUTHORIZED(401, "未登录或 Token 已过期"),
    FORBIDDEN(403, "无权限访问"),
    NOT_FOUND(404, "资源不存在"),
    BAD_REQUEST(400, "请求参数错误"),
    INTERNAL_ERROR(500, "服务器内部错误"),

    // Flink 相关
    FLINK_CLUSTER_NOT_FOUND(1001, "Flink 集群不存在"),
    FLINK_JOB_SUBMIT_FAILED(1002, "Flink 作业提交失败"),
    FLINK_JOB_NOT_FOUND(1003, "Flink 作业不存在"),
    FLINK_SAVEPOINT_FAILED(1004, "Savepoint 操作失败"),

    // Fluss 相关
    FLUSS_CONNECT_FAILED(2001, "Fluss 连接失败"),
    FLUSS_TOPIC_NOT_FOUND(2002, "Fluss Topic 不存在"),

    // Paimon 相关
    PAIMON_CATALOG_FAILED(3001, "Paimon Catalog 操作失败"),
    PAIMON_TABLE_NOT_FOUND(3002, "Paimon 表不存在");

    private final int code;
    private final String message;
}
