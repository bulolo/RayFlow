ALTER TABLE rf_flink_job_version
    ADD COLUMN IF NOT EXISTS image_uri VARCHAR(512),
    ADD COLUMN IF NOT EXISTS image_digest VARCHAR(512),
    ADD COLUMN IF NOT EXISTS image_publish_status VARCHAR(32),
    ADD COLUMN IF NOT EXISTS image_publish_log TEXT;
