-- Per-user Revenue OS surface access. Default true so existing rows keep access after migration.
--
-- Idempotent: skips if column already exists.
SET @db = DATABASE();
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'marketplace_users' AND COLUMN_NAME = 'revenueOsAccess'
);
SET @ddl := IF(
  @col_exists > 0,
  'SELECT 1 AS `_migration_skip_column_exists`',
  'ALTER TABLE `marketplace_users` ADD COLUMN `revenueOsAccess` boolean NOT NULL DEFAULT true'
);
PREPARE _mig_0085 FROM @ddl;
EXECUTE _mig_0085;
DEALLOCATE PREPARE _mig_0085;
