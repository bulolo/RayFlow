-- ==============================================================================
-- RayFlow initial schema
-- ==============================================================================

CREATE TABLE IF NOT EXISTS rf_user (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(64)  NOT NULL UNIQUE,
    password        VARCHAR(256) NOT NULL,
    nickname        VARCHAR(64),
    email           VARCHAR(128),
    role            VARCHAR(32)  NOT NULL DEFAULT 'USER',
    status          INT          NOT NULL DEFAULT 1,
    last_login_at   TIMESTAMP,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted         INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rf_tenant (
    id              BIGSERIAL PRIMARY KEY,
    tenant_name     VARCHAR(128) NOT NULL,
    tenant_slug     VARCHAR(64)  NOT NULL UNIQUE,
    status          VARCHAR(32)  NOT NULL DEFAULT 'ACTIVE',
    description     TEXT,
    default_parallelism INT      NOT NULL DEFAULT 1,
    savepoint_retention INT      NOT NULL DEFAULT 5,
    job_version_retention INT    NOT NULL DEFAULT 5,
    job_execution_retention INT  NOT NULL DEFAULT 10,
    failure_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted         INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rf_tenant_user (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL REFERENCES rf_tenant(id),
    user_id         BIGINT       NOT NULL REFERENCES rf_user(id),
    tenant_role     VARCHAR(32)  NOT NULL DEFAULT 'USER',
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted         INT          NOT NULL DEFAULT 0,
    CONSTRAINT uk_tenant_user UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS rf_notification_channel (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(128) NOT NULL,
    type            VARCHAR(32)  NOT NULL,
    config_json     TEXT,
    enabled         INT          NOT NULL DEFAULT 1,
    tenant_id       BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted         INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rf_flink_cluster (
    id                  BIGSERIAL PRIMARY KEY,
    cluster_name        VARCHAR(128) NOT NULL,
    cluster_type        VARCHAR(32)  NOT NULL DEFAULT 'standalone',
    deployment_mode     VARCHAR(32)  NOT NULL DEFAULT 'session',
    address             VARCHAR(256),
    gateway_address     VARCHAR(256),
    gateway_status      VARCHAR(32)  NOT NULL DEFAULT 'NOT_CONFIGURED',
    status              VARCHAR(32)  NOT NULL DEFAULT 'RUNNING',
    flink_version       VARCHAR(32),
    namespace_name      VARCHAR(128),
    service_account     VARCHAR(128),
    image               VARCHAR(256),
    image_pull_policy   VARCHAR(32),
    service_exposure_type VARCHAR(32),
    kube_config_ref     TEXT,
    pod_template         TEXT,
    default_parallelism INT,
    checkpoint_dir      VARCHAR(512),
    savepoint_dir       VARCHAR(512),
    cluster_scope       VARCHAR(32)  NOT NULL DEFAULT 'TENANT',
    description         TEXT,
    tenant_id           BIGINT       REFERENCES rf_tenant(id),
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted             INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rf_flink_job (
    id                    BIGSERIAL PRIMARY KEY,
    job_name              VARCHAR(256) NOT NULL,
    job_group             VARCHAR(128),
    job_type              VARCHAR(32)  NOT NULL DEFAULT 'JAR',
    runtime_mode          VARCHAR(32)  DEFAULT 'STREAMING',
    submit_type           VARCHAR(32)  NOT NULL DEFAULT 'REST',
    execution_mode        VARCHAR(64)  NOT NULL DEFAULT 'standalone',
    cluster_id            BIGINT       REFERENCES rf_flink_cluster(id),
    current_execution_id  BIGINT,
    flink_job_id          VARCHAR(64),
    status                VARCHAR(32)  NOT NULL DEFAULT 'CREATED',
    publish_status        VARCHAR(32)  NOT NULL DEFAULT 'UNPUBLISHED',
    content               TEXT,
    main_class            VARCHAR(512),
    args                  TEXT,
    flink_config          TEXT,
    parallelism           INT          DEFAULT 1,
    savepoint_path        VARCHAR(512),
    application_image     VARCHAR(256),
    jar_uri               VARCHAR(512),
    dependency_refs       TEXT,
    alert_channel_id      BIGINT       REFERENCES rf_notification_channel(id),
    alert_rule            VARCHAR(128) NOT NULL DEFAULT 'FAILED',
    description           TEXT,
    doc_url               VARCHAR(1024),
    tenant_id             BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_by            BIGINT,
    created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted               INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rf_flink_job_execution (
    id              BIGSERIAL PRIMARY KEY,
    job_id          BIGINT       NOT NULL REFERENCES rf_flink_job(id) ON DELETE CASCADE,
    version_id      BIGINT,
    version_name    VARCHAR(32),
    flink_job_id    VARCHAR(128),
    status          VARCHAR(64)  NOT NULL DEFAULT 'CREATED',
    submit_payload  TEXT,
    error_log       TEXT,
    start_time      TIMESTAMP,
    end_time        TIMESTAMP,
    duration        BIGINT,
    tenant_id       BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_by      BIGINT,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted         INT          NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_flink_job_execution_job
    ON rf_flink_job_execution(job_id, created_at DESC)
    WHERE deleted = 0;

CREATE TABLE IF NOT EXISTS rf_flink_job_version (
    id              BIGSERIAL PRIMARY KEY,
    job_id          BIGINT       NOT NULL REFERENCES rf_flink_job(id) ON DELETE CASCADE,
    version_no      INT          NOT NULL,
    version_name    VARCHAR(32)  NOT NULL,
    snapshot_json   TEXT         NOT NULL,
    remark          TEXT,
    tenant_id       BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_by      BIGINT,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted         INT          NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_flink_job_version_job
    ON rf_flink_job_version(job_id, version_no DESC)
    WHERE deleted = 0;

CREATE TABLE IF NOT EXISTS rf_flink_savepoint (
    id                  BIGSERIAL PRIMARY KEY,
    job_id              BIGINT       NOT NULL REFERENCES rf_flink_job(id),
    job_name            VARCHAR(256) NOT NULL,
    flink_job_id        VARCHAR(64)  NOT NULL,
    request_id          VARCHAR(128),
    location            VARCHAR(512),
    target_directory    VARCHAR(512),
    cancel_job          BOOLEAN      NOT NULL DEFAULT FALSE,
    status              VARCHAR(32)  NOT NULL DEFAULT 'TRIGGERED',
    trigger_message     TEXT,
    tenant_id           BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted             INT          NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_flink_savepoint_job
    ON rf_flink_savepoint(job_id, created_at DESC)
    WHERE deleted = 0;

CREATE TABLE IF NOT EXISTS rf_fluss_cluster (
    id                  BIGSERIAL PRIMARY KEY,
    cluster_name        VARCHAR(128) NOT NULL,
    bootstrap_servers   VARCHAR(512) NOT NULL,
    default_database    VARCHAR(128) NOT NULL DEFAULT 'default',
    status              VARCHAR(32)  NOT NULL DEFAULT 'ACTIVE',
    description         TEXT,
    tenant_id           BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted             INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rf_fluss_topic (
    id                  BIGSERIAL PRIMARY KEY,
    cluster_id          BIGINT       NOT NULL REFERENCES rf_fluss_cluster(id),
    topic_name          VARCHAR(256) NOT NULL,
    namespace_name      VARCHAR(128) NOT NULL DEFAULT 'default',
    bucket_count        INT          DEFAULT 1,
    replication_factor  INT          DEFAULT 1,
    status              VARCHAR(32)  NOT NULL DEFAULT 'CREATED',
    description         TEXT,
    tenant_id           BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted             INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rf_paimon_catalog (
    id              BIGSERIAL PRIMARY KEY,
    catalog_name    VARCHAR(128) NOT NULL,
    warehouse       VARCHAR(512) NOT NULL,
    metastore_type  VARCHAR(64)  NOT NULL DEFAULT 'filesystem',
    options         TEXT,
    status          VARCHAR(32)  NOT NULL DEFAULT 'ACTIVE',
    description     TEXT,
    tenant_id       BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted         INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rf_starrocks_connection (
    id                  BIGSERIAL PRIMARY KEY,
    connection_name     VARCHAR(128) NOT NULL,
    fe_address          VARCHAR(256) NOT NULL,
    query_port          INT          NOT NULL DEFAULT 9030,
    username            VARCHAR(128) NOT NULL,
    password            VARCHAR(256),
    default_database    VARCHAR(128) NOT NULL DEFAULT 'default',
    status              VARCHAR(32)  NOT NULL DEFAULT 'ACTIVE',
    description         TEXT,
    tenant_id           BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted             INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rf_variable (
    id              BIGSERIAL PRIMARY KEY,
    variable_name   VARCHAR(128) NOT NULL,
    variable_value  TEXT,
    description     VARCHAR(512),
    tenant_id       BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted         INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rf_scheduler_workflow (
    id                  BIGSERIAL PRIMARY KEY,
    workflow_name       VARCHAR(256) NOT NULL,
    description         TEXT,
    cron                VARCHAR(128),
    period              VARCHAR(128),
    timezone            VARCHAR(64)  NOT NULL DEFAULT 'UTC',
    status              VARCHAR(32)  NOT NULL DEFAULT 'PAUSED',
    execution_mode      VARCHAR(32)  NOT NULL DEFAULT 'TOPOLOGY',
    failure_strategy    VARCHAR(32)  NOT NULL DEFAULT 'BLOCK_ALL',
    concurrent_policy   VARCHAR(32)  NOT NULL DEFAULT 'SERIAL_RUNS',
    alert_channel_id    BIGINT       REFERENCES rf_notification_channel(id),
    last_run_time       TIMESTAMP,
    next_run_time       TIMESTAMP,
    tenant_id           BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_by          BIGINT,
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted             INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rf_scheduler_workflow_node (
    id                  BIGSERIAL PRIMARY KEY,
    workflow_id         BIGINT       NOT NULL REFERENCES rf_scheduler_workflow(id),
    node_key            VARCHAR(64)  NOT NULL,
    flink_job_id        BIGINT       NOT NULL REFERENCES rf_flink_job(id),
    job_name            VARCHAR(256) NOT NULL,
    job_type            VARCHAR(32)  NOT NULL,
    max_retries         INT          NOT NULL DEFAULT 0,
    retry_interval      INT          NOT NULL DEFAULT 60,
    timeout_minutes     INT          NOT NULL DEFAULT 0,
    on_timeout          VARCHAR(32)  NOT NULL DEFAULT 'ALARM_ONLY',
    position_x          INT          NOT NULL DEFAULT 40,
    position_y          INT          NOT NULL DEFAULT 80,
    tenant_id           BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted             INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rf_scheduler_workflow_edge (
    id                  BIGSERIAL PRIMARY KEY,
    workflow_id         BIGINT       NOT NULL REFERENCES rf_scheduler_workflow(id),
    from_node_key       VARCHAR(64)  NOT NULL,
    to_node_key         VARCHAR(64)  NOT NULL,
    strategy            VARCHAR(32)  NOT NULL DEFAULT 'WAIT_SUCCESS',
    tenant_id           BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted             INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rf_scheduler_workflow_variable (
    id                  BIGSERIAL PRIMARY KEY,
    workflow_id         BIGINT       NOT NULL REFERENCES rf_scheduler_workflow(id),
    variable_key        VARCHAR(128) NOT NULL,
    variable_value      TEXT,
    tenant_id           BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted             INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rf_scheduler_workflow_version (
    id                  BIGSERIAL PRIMARY KEY,
    workflow_id         BIGINT       NOT NULL REFERENCES rf_scheduler_workflow(id),
    version_no          INT          NOT NULL,
    version_name        VARCHAR(32)  NOT NULL,
    snapshot_json       TEXT         NOT NULL,
    remark              TEXT,
    tenant_id           BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_by          BIGINT,
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted             INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rf_scheduler_execution (
    id                  BIGSERIAL PRIMARY KEY,
    workflow_id         BIGINT       NOT NULL REFERENCES rf_scheduler_workflow(id),
    version_id          BIGINT       REFERENCES rf_scheduler_workflow_version(id),
    trigger_type        VARCHAR(32)  NOT NULL DEFAULT 'MANUAL',
    status              VARCHAR(32)  NOT NULL DEFAULT 'CREATED',
    message             TEXT,
    started_at          TIMESTAMP,
    finished_at         TIMESTAMP,
    owner_instance_id   VARCHAR(128),
    heartbeat_at        TIMESTAMP,
    tenant_id           BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_by          BIGINT,
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted             INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rf_scheduler_node_execution (
    id                    BIGSERIAL PRIMARY KEY,
    execution_id          BIGINT       NOT NULL REFERENCES rf_scheduler_execution(id),
    workflow_id           BIGINT       NOT NULL REFERENCES rf_scheduler_workflow(id),
    node_key              VARCHAR(64)  NOT NULL,
    flink_job_id          BIGINT       NOT NULL REFERENCES rf_flink_job(id),
    flink_runtime_job_id  VARCHAR(128),
    status                VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
    retry_index           INT          NOT NULL DEFAULT 0,
    message               TEXT,
    started_at            TIMESTAMP,
    finished_at           TIMESTAMP,
    tenant_id             BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted               INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rf_scheduler_execution_log (
    id                  BIGSERIAL PRIMARY KEY,
    execution_id        BIGINT       NOT NULL REFERENCES rf_scheduler_execution(id),
    workflow_id         BIGINT       NOT NULL REFERENCES rf_scheduler_workflow(id),
    node_execution_id   BIGINT       REFERENCES rf_scheduler_node_execution(id),
    node_key            VARCHAR(64),
    level               VARCHAR(16)  NOT NULL DEFAULT 'INFO',
    event_type          VARCHAR(64)  NOT NULL,
    message             TEXT         NOT NULL,
    tenant_id           BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted             INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rf_model_provider_config (
    id                  BIGSERIAL PRIMARY KEY,
    provider            VARCHAR(32)  NOT NULL DEFAULT 'openai_compatible',
    base_url            VARCHAR(512) NOT NULL,
    api_key             VARCHAR(512),
    default_model       VARCHAR(128) NOT NULL,
    models              TEXT,
    enabled             INT          NOT NULL DEFAULT 0,
    tenant_id           BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted             INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rf_flink_jar_resource (
    id                       BIGSERIAL PRIMARY KEY,
    resource_name            VARCHAR(128) NOT NULL,
    resource_version         VARCHAR(64)  NOT NULL DEFAULT '1.0.0',
    compatible_flink_version VARCHAR(64)  NOT NULL DEFAULT '2.x',
    storage_uri              VARCHAR(512) NOT NULL,
    checksum                 VARCHAR(128),
    status                   VARCHAR(32)  NOT NULL DEFAULT 'ACTIVE',
    tenant_id                BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted                  INT          NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_user_username ON rf_user(username);
CREATE INDEX IF NOT EXISTS idx_tenant_slug ON rf_tenant(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_tenant_user_tenant ON rf_tenant_user(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_user_user ON rf_tenant_user(user_id);
CREATE INDEX IF NOT EXISTS idx_cluster_tenant ON rf_flink_cluster(tenant_id);
CREATE INDEX IF NOT EXISTS idx_flink_job_status ON rf_flink_job(status);
CREATE INDEX IF NOT EXISTS idx_flink_job_cluster ON rf_flink_job(cluster_id);
CREATE INDEX IF NOT EXISTS idx_flink_job_alert_channel ON rf_flink_job(alert_channel_id);
CREATE INDEX IF NOT EXISTS idx_job_tenant ON rf_flink_job(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fluss_cluster_tenant ON rf_fluss_cluster(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fluss_topic_namespace ON rf_fluss_topic(namespace_name);
CREATE INDEX IF NOT EXISTS idx_fluss_topic_tenant ON rf_fluss_topic(tenant_id);
CREATE INDEX IF NOT EXISTS idx_paimon_catalog_name ON rf_paimon_catalog(catalog_name);
CREATE INDEX IF NOT EXISTS idx_paimon_catalog_tenant ON rf_paimon_catalog(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_channel_tenant ON rf_notification_channel(tenant_id);
CREATE INDEX IF NOT EXISTS idx_variable_tenant ON rf_variable(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_workflow_tenant ON rf_scheduler_workflow(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_workflow_status ON rf_scheduler_workflow(status);
CREATE INDEX IF NOT EXISTS idx_scheduler_node_workflow ON rf_scheduler_workflow_node(workflow_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_edge_workflow ON rf_scheduler_workflow_edge(workflow_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_variable_workflow ON rf_scheduler_workflow_variable(workflow_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_version_workflow ON rf_scheduler_workflow_version(workflow_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_execution_workflow ON rf_scheduler_execution(workflow_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_execution_tenant ON rf_scheduler_execution(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_execution_log_execution ON rf_scheduler_execution_log(execution_id, id);
CREATE INDEX IF NOT EXISTS idx_scheduler_execution_log_tenant ON rf_scheduler_execution_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_model_provider_tenant ON rf_model_provider_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_flink_jar_resource_tenant ON rf_flink_jar_resource(tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uk_variable_tenant_name ON rf_variable(tenant_id, variable_name) WHERE deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS uk_scheduler_node_key ON rf_scheduler_workflow_node(workflow_id, node_key) WHERE deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS uk_scheduler_edge ON rf_scheduler_workflow_edge(workflow_id, from_node_key, to_node_key) WHERE deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS uk_scheduler_variable ON rf_scheduler_workflow_variable(workflow_id, variable_key) WHERE deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS uk_scheduler_version ON rf_scheduler_workflow_version(workflow_id, version_no) WHERE deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS uk_flink_job_version ON rf_flink_job_version(job_id, version_no) WHERE deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS uk_model_provider_tenant ON rf_model_provider_config(tenant_id) WHERE deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS uk_flink_jar_resource_name_version ON rf_flink_jar_resource(tenant_id, resource_name, resource_version) WHERE deleted = 0;
