-- Phase 4H — Persisted Content Engine variants + link deployments to saved generation rows.
-- Restored after file was emptied; if TiDB already applied this migration, align checksum with: --mark-file or UPDATE drizzle_sql_migrations.

CREATE TABLE IF NOT EXISTS `bentley_generation_variants` (
  `id` varchar(36) NOT NULL,
  `userId` int NOT NULL,
  `experimentGroupId` varchar(36) NOT NULL,
  `variantTag` varchar(16) NOT NULL DEFAULT 'A',
  `engineKind` varchar(32) NOT NULL DEFAULT 'content_engine',
  `title` varchar(512) NOT NULL DEFAULT '',
  `unifiedContextSnapshotJson` json NOT NULL,
  `generatedOutputJson` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bentley_gen_var_user_created` (`userId`, `createdAt`),
  KEY `bentley_gen_var_user_group` (`userId`, `experimentGroupId`),
  CONSTRAINT `bentley_gen_var_user_fk` FOREIGN KEY (`userId`) REFERENCES `marketplace_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `bentley_content_deployments`
  ADD COLUMN `generationVariantId` varchar(36) NULL DEFAULT NULL AFTER `contentEngineHash`,
  ADD KEY `bentley_cd_genvar` (`userId`, `generationVariantId`);
