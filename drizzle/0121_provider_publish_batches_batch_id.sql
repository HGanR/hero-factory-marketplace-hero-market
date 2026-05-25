-- Weekly Content360 batch scheduling: batch header + optional job.batch_id
-- Idempotent indexes/column: table may already exist from runtime `ensureClientHubTables` with identical index names.
-- Each statement is separated by Drizzle's breakpoint so TiDB never receives multi-statement batches (errno 8130).
CREATE TABLE IF NOT EXISTS `provider_publish_batches` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `client_id` varchar(36) NOT NULL,
  `campaign_id` varchar(36) NOT NULL,
  `provider` varchar(32) NOT NULL,
  `connection_id` varchar(36) NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'pending',
  `total_posts` int NOT NULL,
  `scheduled_count` int NOT NULL DEFAULT 0,
  `failed_count` int NOT NULL DEFAULT 0,
  `timezone` varchar(64) NOT NULL,
  `provider_batch_id` varchar(120),
  `provider_response_json` json,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `provider_publish_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
SET @db = DATABASE();
--> statement-breakpoint
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'provider_publish_batches' AND INDEX_NAME = 'provider_publish_batches_client_id_idx'
);
--> statement-breakpoint
SET @ddl := IF(
  @idx_exists > 0,
  'SELECT 1 AS `_migration_skip_index_exists`',
  'CREATE INDEX `provider_publish_batches_client_id_idx` ON `provider_publish_batches` (`client_id`)'
);
--> statement-breakpoint
PREPARE _mig_0121_client FROM @ddl;
--> statement-breakpoint
EXECUTE _mig_0121_client;
--> statement-breakpoint
DEALLOCATE PREPARE _mig_0121_client;
--> statement-breakpoint
SET @db = DATABASE();
--> statement-breakpoint
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'provider_publish_batches' AND INDEX_NAME = 'provider_publish_batches_campaign_id_idx'
);
--> statement-breakpoint
SET @ddl := IF(
  @idx_exists > 0,
  'SELECT 1 AS `_migration_skip_index_exists`',
  'CREATE INDEX `provider_publish_batches_campaign_id_idx` ON `provider_publish_batches` (`campaign_id`)'
);
--> statement-breakpoint
PREPARE _mig_0121_campaign FROM @ddl;
--> statement-breakpoint
EXECUTE _mig_0121_campaign;
--> statement-breakpoint
DEALLOCATE PREPARE _mig_0121_campaign;
--> statement-breakpoint
SET @db = DATABASE();
--> statement-breakpoint
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'provider_publish_batches' AND INDEX_NAME = 'provider_publish_batches_status_idx'
);
--> statement-breakpoint
SET @ddl := IF(
  @idx_exists > 0,
  'SELECT 1 AS `_migration_skip_index_exists`',
  'CREATE INDEX `provider_publish_batches_status_idx` ON `provider_publish_batches` (`status`)'
);
--> statement-breakpoint
PREPARE _mig_0121_status FROM @ddl;
--> statement-breakpoint
EXECUTE _mig_0121_status;
--> statement-breakpoint
DEALLOCATE PREPARE _mig_0121_status;
--> statement-breakpoint
SET @db = DATABASE();
--> statement-breakpoint
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'provider_publish_jobs' AND COLUMN_NAME = 'batch_id'
);
--> statement-breakpoint
SET @ddl := IF(
  @col_exists > 0,
  'SELECT 1 AS `_migration_skip_column_exists`',
  'ALTER TABLE `provider_publish_jobs` ADD COLUMN `batch_id` varchar(36)'
);
--> statement-breakpoint
PREPARE _mig_0121_batch_col FROM @ddl;
--> statement-breakpoint
EXECUTE _mig_0121_batch_col;
--> statement-breakpoint
DEALLOCATE PREPARE _mig_0121_batch_col;
--> statement-breakpoint
SET @db = DATABASE();
--> statement-breakpoint
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'provider_publish_jobs' AND INDEX_NAME = 'provider_publish_jobs_batch_id_idx'
);
--> statement-breakpoint
SET @ddl := IF(
  @idx_exists > 0,
  'SELECT 1 AS `_migration_skip_index_exists`',
  'CREATE INDEX `provider_publish_jobs_batch_id_idx` ON `provider_publish_jobs` (`batch_id`)'
);
--> statement-breakpoint
PREPARE _mig_0121_jobs_batch FROM @ddl;
--> statement-breakpoint
EXECUTE _mig_0121_jobs_batch;
--> statement-breakpoint
DEALLOCATE PREPARE _mig_0121_jobs_batch;
