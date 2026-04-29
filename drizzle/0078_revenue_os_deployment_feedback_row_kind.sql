-- Distinguish publish-outcome rows from append-only performance metric snapshots (additive).
ALTER TABLE `revenue_os_deployment_feedback`
  ADD COLUMN `feedback_row_kind` VARCHAR(32) NOT NULL DEFAULT 'publish_outcome'
  AFTER `publish_status`;
