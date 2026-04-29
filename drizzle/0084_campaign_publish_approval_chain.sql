-- Campaign-level multi-step publish approval chain (JSON). Null = legacy single-step behavior.
--
-- Idempotent: skips if `campaigns` is missing or column already exists.
-- The `campaigns` table is created in `0001_add_marketplace_phone.sql`. If you see
-- `_migration_skip_campaigns_missing`, apply baseline migrations first (e.g. full
-- `npm run db:migrate:all`), then either:
--   DELETE FROM drizzle_sql_migrations WHERE filename = 'drizzle/0084_campaign_publish_approval_chain.sql';
--   and re-run migrations, or run the ALTER manually once `campaigns` exists.
SET @db = DATABASE();
SET @tbl_exists := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaigns'
);
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'publish_approval_chain_json'
);
SET @ddl := IF(
  @tbl_exists = 0,
  'SELECT 1 AS `_migration_skip_campaigns_missing`',
  IF(
    @col_exists > 0,
    'SELECT 1 AS `_migration_skip_column_exists`',
    'ALTER TABLE `campaigns` ADD COLUMN `publish_approval_chain_json` JSON NULL AFTER `end_at`'
  )
);
PREPARE _mig_0084 FROM @ddl;
EXECUTE _mig_0084;
DEALLOCATE PREPARE _mig_0084;
