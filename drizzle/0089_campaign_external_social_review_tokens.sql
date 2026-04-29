-- Part 39: opaque tokens for external/client review of governed social posts (same UTM approval model).

SET @db = DATABASE();

SET @tbl_exists := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaign_external_social_review_tokens'
);

SET @ddl_create := IF(
  @tbl_exists > 0,
  'SELECT 1 AS `_skip_0089_campaign_external_social_review_tokens`',
  'CREATE TABLE `campaign_external_social_review_tokens` (
  `id` varchar(36) NOT NULL,
  `campaign_id` varchar(36) NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `created_by_user_id` varchar(64) NOT NULL,
  `label` varchar(200) NULL,
  `allowed_roles_json` json NOT NULL,
  `expires_at` timestamp NULL,
  `revoked_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `camp_ext_soc_rev_tok_hash_uidx` (`token_hash`),
  KEY `camp_ext_soc_rev_tok_campaign_idx` (`campaign_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);

PREPARE _mig_0089_create FROM @ddl_create;
EXECUTE _mig_0089_create;
DEALLOCATE PREPARE _mig_0089_create;
