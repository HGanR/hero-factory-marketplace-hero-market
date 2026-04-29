-- Post-level optimization memory derived from deployment feedback (additive).
CREATE TABLE IF NOT EXISTS `revenue_os_post_optimization_memory` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `client_id` VARCHAR(36) NOT NULL DEFAULT '',
  `trust_id` VARCHAR(64) NULL,
  `pattern_key` VARCHAR(64) NOT NULL,
  `platform` VARCHAR(24) NOT NULL,
  `content_type` VARCHAR(80) NULL,
  `hook_text` TEXT NULL,
  `angle_text` TEXT NULL,
  `cta_text` TEXT NULL,
  `source` VARCHAR(32) NOT NULL,
  `outcome_kind` VARCHAR(24) NOT NULL,
  `summary_text` TEXT NOT NULL,
  `evidence_json` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `rev_os_pom_user_client_pattern` (`user_id`, `client_id`, `pattern_key`),
  KEY `rev_os_pom_user_upd` (`user_id`, `updated_at`),
  KEY `rev_os_pom_client_upd` (`client_id`, `updated_at`),
  KEY `rev_os_pom_plat_upd` (`platform`, `updated_at`)
);
