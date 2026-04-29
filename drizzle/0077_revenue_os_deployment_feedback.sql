-- Queryable deployment feedback for AI Revenue OS closed-loop signals.
CREATE TABLE IF NOT EXISTS `revenue_os_deployment_feedback` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `campaign_id` VARCHAR(36) NOT NULL,
  `campaign_post_id` VARCHAR(36) NOT NULL,
  `platform` VARCHAR(24) NOT NULL,
  `publish_status` VARCHAR(32) NOT NULL,
  `feedback_json` JSON NOT NULL,
  `published_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `rev_os_df_user_created` (`user_id`, `created_at`),
  KEY `rev_os_df_post` (`campaign_post_id`),
  KEY `rev_os_df_campaign` (`campaign_id`)
);
