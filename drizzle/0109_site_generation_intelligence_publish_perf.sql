-- Site generation intelligence: publish + rollup columns + composite index.
-- Idempotent: skips ALTER when column/index already exists (e.g. after a prior apply of this migration).

SET @__db := DATABASE();

-- publishedAt
SET @__sql = (SELECT IF(
  (SELECT COUNT(*) FROM `information_schema`.`COLUMNS`
   WHERE `TABLE_SCHEMA` = @__db AND `TABLE_NAME` = 'site_generation_runs' AND `COLUMN_NAME` = 'publishedAt') > 0,
  'SELECT 1',
  'ALTER TABLE `site_generation_runs` ADD COLUMN `publishedAt` timestamp NULL DEFAULT NULL'
));
PREPARE `__s` FROM @__sql;
EXECUTE `__s`;
DEALLOCATE PREPARE `__s`;

-- deployedUrl
SET @__sql = (SELECT IF(
  (SELECT COUNT(*) FROM `information_schema`.`COLUMNS`
   WHERE `TABLE_SCHEMA` = @__db AND `TABLE_NAME` = 'site_generation_runs' AND `COLUMN_NAME` = 'deployedUrl') > 0,
  'SELECT 1',
  'ALTER TABLE `site_generation_runs` ADD COLUMN `deployedUrl` varchar(512) NULL DEFAULT NULL'
));
PREPARE `__s` FROM @__sql;
EXECUTE `__s`;
DEALLOCATE PREPARE `__s`;

-- publishedVersionId
SET @__sql = (SELECT IF(
  (SELECT COUNT(*) FROM `information_schema`.`COLUMNS`
   WHERE `TABLE_SCHEMA` = @__db AND `TABLE_NAME` = 'site_generation_runs' AND `COLUMN_NAME` = 'publishedVersionId') > 0,
  'SELECT 1',
  'ALTER TABLE `site_generation_runs` ADD COLUMN `publishedVersionId` varchar(36) NULL DEFAULT NULL'
));
PREPARE `__s` FROM @__sql;
EXECUTE `__s`;
DEALLOCATE PREPARE `__s`;

-- rollupLeadsCaptured
SET @__sql = (SELECT IF(
  (SELECT COUNT(*) FROM `information_schema`.`COLUMNS`
   WHERE `TABLE_SCHEMA` = @__db AND `TABLE_NAME` = 'site_generation_runs' AND `COLUMN_NAME` = 'rollupLeadsCaptured') > 0,
  'SELECT 1',
  'ALTER TABLE `site_generation_runs` ADD COLUMN `rollupLeadsCaptured` int NULL DEFAULT NULL'
));
PREPARE `__s` FROM @__sql;
EXECUTE `__s`;
DEALLOCATE PREPARE `__s`;

-- rollupConversationsOpened
SET @__sql = (SELECT IF(
  (SELECT COUNT(*) FROM `information_schema`.`COLUMNS`
   WHERE `TABLE_SCHEMA` = @__db AND `TABLE_NAME` = 'site_generation_runs' AND `COLUMN_NAME` = 'rollupConversationsOpened') > 0,
  'SELECT 1',
  'ALTER TABLE `site_generation_runs` ADD COLUMN `rollupConversationsOpened` int NULL DEFAULT NULL'
));
PREPARE `__s` FROM @__sql;
EXECUTE `__s`;
DEALLOCATE PREPARE `__s`;

-- rollupWidgetMessages
SET @__sql = (SELECT IF(
  (SELECT COUNT(*) FROM `information_schema`.`COLUMNS`
   WHERE `TABLE_SCHEMA` = @__db AND `TABLE_NAME` = 'site_generation_runs' AND `COLUMN_NAME` = 'rollupWidgetMessages') > 0,
  'SELECT 1',
  'ALTER TABLE `site_generation_runs` ADD COLUMN `rollupWidgetMessages` int NULL DEFAULT NULL'
));
PREPARE `__s` FROM @__sql;
EXECUTE `__s`;
DEALLOCATE PREPARE `__s`;

-- rollupBookingsScheduled
SET @__sql = (SELECT IF(
  (SELECT COUNT(*) FROM `information_schema`.`COLUMNS`
   WHERE `TABLE_SCHEMA` = @__db AND `TABLE_NAME` = 'site_generation_runs' AND `COLUMN_NAME` = 'rollupBookingsScheduled') > 0,
  'SELECT 1',
  'ALTER TABLE `site_generation_runs` ADD COLUMN `rollupBookingsScheduled` int NULL DEFAULT NULL'
));
PREPARE `__s` FROM @__sql;
EXECUTE `__s`;
DEALLOCATE PREPARE `__s`;

-- Composite index
SET @__sql = (SELECT IF(
  (SELECT COUNT(*) FROM `information_schema`.`STATISTICS`
   WHERE `TABLE_SCHEMA` = @__db AND `TABLE_NAME` = 'site_generation_runs' AND `INDEX_NAME` = 'sgr_site_user_created') > 0,
  'SELECT 1',
  'ALTER TABLE `site_generation_runs` ADD INDEX `sgr_site_user_created` (`siteId`, `userId`, `createdAt`)'
));
PREPARE `__s` FROM @__sql;
EXECUTE `__s`;
DEALLOCATE PREPARE `__s`;
