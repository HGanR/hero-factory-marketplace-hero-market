-- Part 57: supporting indexes for ROW_NUMBER latest-per-id reads on snapshot tables.
-- Covers PARTITION BY … ORDER BY fetched_at DESC, id DESC (organic + paid batch helpers).
-- Requires MySQL 8+ / TiDB with descending index support (same as window-function requirement).

SET @db = DATABASE();

-- Organic: campaign_post_analytics_snapshots
SET @cp_tbl := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaign_post_analytics_snapshots'
);
SET @cp_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaign_post_analytics_snapshots'
    AND INDEX_NAME = 'cp_analytics_latest_per_post_read_idx'
);

SET @ddl_cp_idx := IF(
  @cp_tbl = 0 OR @cp_idx > 0,
  'SELECT 1 AS `_skip_0090_cp_analytics_latest_per_post_read_idx`',
  'CREATE INDEX `cp_analytics_latest_per_post_read_idx` ON `campaign_post_analytics_snapshots` (`campaign_post_id`, `fetched_at` DESC, `id` DESC)'
);
PREPARE _mig_0090_cp_idx FROM @ddl_cp_idx;
EXECUTE _mig_0090_cp_idx;
DEALLOCATE PREPARE _mig_0090_cp_idx;

-- Paid: campaign_paid_social_analytics_snapshots
SET @paid_tbl := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaign_paid_social_analytics_snapshots'
);
SET @paid_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaign_paid_social_analytics_snapshots'
    AND INDEX_NAME = 'camp_paid_soc_analytics_latest_per_paid_read_idx'
);

SET @ddl_paid_idx := IF(
  @paid_tbl = 0 OR @paid_idx > 0,
  'SELECT 1 AS `_skip_0090_camp_paid_soc_analytics_latest_per_paid_read_idx`',
  'CREATE INDEX `camp_paid_soc_analytics_latest_per_paid_read_idx` ON `campaign_paid_social_analytics_snapshots` (`campaign_paid_social_campaign_id`, `fetched_at` DESC, `id` DESC)'
);
PREPARE _mig_0090_paid_idx FROM @ddl_paid_idx;
EXECUTE _mig_0090_paid_idx;
DEALLOCATE PREPARE _mig_0090_paid_idx;
