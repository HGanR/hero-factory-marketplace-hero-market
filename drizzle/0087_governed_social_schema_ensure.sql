-- Idempotent duplicate of 0086 guards: applies `social_account_id` / index / social_accounts index changes
-- when baseline (`campaign_posts`, `social_accounts`) was added *after* 0086 had already been marked applied as a no-op.

SET @db = DATABASE();

SET @cp_exists := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaign_posts'
);
SET @cp_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaign_posts' AND COLUMN_NAME = 'social_account_id'
);
SET @cp_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaign_posts' AND INDEX_NAME = 'campost_social_account_idx'
);

SET @ddl_cp_col := IF(
  @cp_exists = 0 OR @cp_col > 0,
  'SELECT 1 AS `_skip_0087_campaign_posts_social_account_id`',
  'ALTER TABLE `campaign_posts` ADD COLUMN `social_account_id` varchar(36) NULL'
);
PREPARE _mig_0087_cp_col FROM @ddl_cp_col;
EXECUTE _mig_0087_cp_col;
DEALLOCATE PREPARE _mig_0087_cp_col;

SET @ddl_cp_idx := IF(
  @cp_exists = 0 OR @cp_idx > 0,
  'SELECT 1 AS `_skip_0087_campost_social_account_idx`',
  'CREATE INDEX `campost_social_account_idx` ON `campaign_posts` (`social_account_id`)'
);
PREPARE _mig_0087_cp_idx FROM @ddl_cp_idx;
EXECUTE _mig_0087_cp_idx;
DEALLOCATE PREPARE _mig_0087_cp_idx;

SET @sa_exists := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'social_accounts'
);
SET @sa_old_uq := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'social_accounts' AND INDEX_NAME = 'socacc_user_platform_uidx'
);
SET @sa_new_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'social_accounts' AND INDEX_NAME = 'socacc_user_client_platform_idx'
);

SET @ddl_sa_drop := IF(
  @sa_exists = 0 OR @sa_old_uq = 0,
  'SELECT 1 AS `_skip_0087_drop_socacc_user_platform_uidx`',
  'ALTER TABLE `social_accounts` DROP INDEX `socacc_user_platform_uidx`'
);
PREPARE _mig_0087_sa_drop FROM @ddl_sa_drop;
EXECUTE _mig_0087_sa_drop;
DEALLOCATE PREPARE _mig_0087_sa_drop;

SET @ddl_sa_idx := IF(
  @sa_exists = 0 OR @sa_new_idx > 0,
  'SELECT 1 AS `_skip_0087_socacc_user_client_platform_idx`',
  'CREATE INDEX `socacc_user_client_platform_idx` ON `social_accounts` (`user_id`, `client_id`, `platform`)'
);
PREPARE _mig_0087_sa_idx FROM @ddl_sa_idx;
EXECUTE _mig_0087_sa_idx;
DEALLOCATE PREPARE _mig_0087_sa_idx;
