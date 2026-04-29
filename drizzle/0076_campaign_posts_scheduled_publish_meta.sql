-- Additive JSON metadata for scheduled publish worker (retries, source, next attempt).
-- Idempotent: skips if `campaign_posts` is missing (base schema not applied yet) or column already exists.
SET @db = DATABASE();
SET @tbl_exists := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaign_posts'
);
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaign_posts' AND COLUMN_NAME = 'scheduled_publish_meta'
);
SET @utm_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaign_posts' AND COLUMN_NAME = 'utm_params'
);
SET @ddl := IF(
  @tbl_exists = 0,
  'SELECT 1 AS `_migration_skip_campaign_posts_missing`',
  IF(
    @col_exists > 0,
    'SELECT 1 AS `_migration_skip_column_exists`',
    IF(
      @utm_exists > 0,
      'ALTER TABLE `campaign_posts` ADD COLUMN `scheduled_publish_meta` JSON NULL AFTER `utm_params`',
      'ALTER TABLE `campaign_posts` ADD COLUMN `scheduled_publish_meta` JSON NULL'
    )
  )
);
PREPARE _mig_0076 FROM @ddl;
EXECUTE _mig_0076;
DEALLOCATE PREPARE _mig_0076;
