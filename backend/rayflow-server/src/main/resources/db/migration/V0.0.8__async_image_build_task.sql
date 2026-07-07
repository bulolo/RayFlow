-- Add build task tracking field to rf_flink_job_version.
-- Stores the worker task ID so the backend poller can query build status asynchronously.
ALTER TABLE rf_flink_job_version
    ADD COLUMN IF NOT EXISTS image_build_task_id VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_flink_job_version_build_task
    ON rf_flink_job_version(image_build_task_id)
    WHERE image_build_task_id IS NOT NULL AND deleted = 0;
