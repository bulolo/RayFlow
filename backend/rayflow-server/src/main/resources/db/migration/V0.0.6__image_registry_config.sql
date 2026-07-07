CREATE TABLE IF NOT EXISTS rf_image_registry_config (
    id             BIGSERIAL PRIMARY KEY,
    registry_url   VARCHAR(512) NOT NULL,
    namespace_name VARCHAR(128),
    username       VARCHAR(256),
    password       VARCHAR(512),
    enabled        INT          NOT NULL DEFAULT 0,
    tenant_id      BIGINT       NOT NULL REFERENCES rf_tenant(id),
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted        INT          NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_image_registry_tenant ON rf_image_registry_config(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_image_registry_tenant ON rf_image_registry_config(tenant_id) WHERE deleted = 0;
