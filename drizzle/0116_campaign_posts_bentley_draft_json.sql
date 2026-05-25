-- Greenfield / empty DB: create `campaign_posts` when missing (includes `bentley_draft_json`).
-- Single statement for TiDB (no multi-statement scripts). If the table already exists, this is a no-op.
-- Existing deployments that already have `campaign_posts` but lack the column: see migration `0117`.
CREATE TABLE IF NOT EXISTS `campaign_posts` (
  `id` varchar(36) NOT NULL,
  `campaign_id` varchar(36) NOT NULL,
  `asset_id` varchar(36) NULL,
  `social_account_id` varchar(36) NULL,
  `platform` varchar(24) NOT NULL,
  `scheduled_at` timestamp NULL,
  `status` varchar(24) NOT NULL DEFAULT 'DRAFT',
  `caption` text NULL,
  `bentley_draft_json` json NULL,
  `hashtags` varchar(1000) NULL,
  `link_url` varchar(512) NULL,
  `utm_params` json NULL,
  `scheduled_publish_meta` json NULL,
  `platform_post_id` varchar(120) NULL,
  `error_message` text NULL,
  `posted_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
