package com.rayflow.server.model.enums;

public final class SchedulerConstants {

    public static final String WORKFLOW_STATUS_ACTIVE = "ACTIVE";
    public static final String WORKFLOW_STATUS_PAUSED = "PAUSED";
    public static final String WORKFLOW_STATUS_PATTERN = "ACTIVE|PAUSED";

    public static final String EXECUTION_MODE_TOPOLOGY = "TOPOLOGY";
    public static final String EXECUTION_MODE_SERIAL_QUEUE = "SERIAL_QUEUE";
    public static final String EXECUTION_MODE_PATTERN = "TOPOLOGY|SERIAL_QUEUE";

    public static final String FAILURE_STRATEGY_BLOCK_ALL = "BLOCK_ALL";
    public static final String FAILURE_STRATEGY_CONTINUE_NEXT = "CONTINUE_NEXT";
    public static final String FAILURE_STRATEGY_PATTERN = "BLOCK_ALL|CONTINUE_NEXT";

    public static final String CONCURRENT_POLICY_SERIAL_RUNS = "SERIAL_RUNS";
    public static final String CONCURRENT_POLICY_CONCURRENT = "CONCURRENT";
    public static final String CONCURRENT_POLICY_PATTERN = "SERIAL_RUNS|CONCURRENT";

    public static final String EDGE_STRATEGY_WAIT_SUCCESS = "WAIT_SUCCESS";
    public static final String EDGE_STRATEGY_WAIT_ENDED = "WAIT_ENDED";
    public static final String EDGE_STRATEGY_WAIT_FAILED = "WAIT_FAILED";
    public static final String EDGE_STRATEGY_PATTERN = "WAIT_SUCCESS|WAIT_ENDED|WAIT_FAILED";

    public static final String TIMEOUT_POLICY_ALARM_ONLY = "ALARM_ONLY";
    public static final String TIMEOUT_POLICY_KILL_AND_ALARM = "KILL_AND_ALARM";
    public static final String TIMEOUT_POLICY_PATTERN = "ALARM_ONLY|KILL_AND_ALARM";

    public static final String EXECUTION_STATUS_SUCCESS = "SUCCESS";
    public static final String EXECUTION_STATUS_RUNNING = "RUNNING";
    public static final String EXECUTION_STATUS_FAILED = "FAILED";
    public static final String EXECUTION_STATUS_PENDING = "PENDING";
    public static final String EXECUTION_STATUS_RETRYING = "RETRYING";
    public static final String EXECUTION_STATUS_SKIPPED = "SKIPPED";
    public static final String EXECUTION_STATUS_CANCELED = "CANCELED";

    public static final String FLINK_STATUS_FINISHED = "FINISHED";
    public static final String FLINK_STATUS_FAILED = "FAILED";
    public static final String FLINK_STATUS_CANCELED = "CANCELED";
    public static final String FLINK_STATUS_SUSPENDED = "SUSPENDED";

    private SchedulerConstants() {
    }
}
