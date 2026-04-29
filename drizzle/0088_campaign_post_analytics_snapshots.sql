-- Governed social post performance snapshots (append-only read model; Part 38).
-- Normalized metrics live in `metrics_json`; multiple rows per post over time.

SET @db = DATABASE();

SET @tbl_exists := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaign_post_analytics_snapshots'
);

SET @ddl_create := IF(
  @tbl_exists > 0,
  'SELECT 1 AS `_skip_0088_campaign_post_analytics_snapshots`',
  'CREATE TABLE `campaign_post_analytics_snapshots` (
  `id` varchar(36) NOT NULL,
  `campaign_post_id` varchar(36) NOT NULL,
  `provider` varchar(24) NOT NULL,
  `provider_post_id` varchar(120) NULL,
  `snapshot_type` varchar(32) NOT NULL DEFAULT ''platform_lifetime'',
  `metrics_json` json NOT NULL,
  `fetched_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `cp_analytics_post_fetched_idx` (`campaign_post_id`, `fetched_at`),
  KEY `cp_analytics_provider_idx` (`provider`, `fetched_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);

PREPARE _mig_0088_create FROM @ddl_create;
EXECUTE _mig_0088_create;
DEALLOCATE PREPARE _mig_0088_create;
