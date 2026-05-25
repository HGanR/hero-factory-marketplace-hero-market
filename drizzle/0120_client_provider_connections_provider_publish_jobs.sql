-- Phase 1: Bentley → Content360 (and future providers) — client-scoped connections + publish jobs.
CREATE TABLE IF NOT EXISTS `client_provider_connections` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `client_id` varchar(36) NOT NULL,
  `provider` varchar(32) NOT NULL,
  `account_name` varchar(200) NOT NULL,
  `external_account_id` varchar(120),
  `access_token_enc` text,
  `refresh_token_enc` text,
  `connection_status` varchar(32) NOT NULL DEFAULT 'pending',
  `last_verified_at` timestamp NULL,
  `metadata_json` json,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `client_provider_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `client_provider_connections_client_id_idx` ON `client_provider_connections` (`client_id`);
--> statement-breakpoint
CREATE INDEX `client_provider_connections_user_id_idx` ON `client_provider_connections` (`user_id`);
--> statement-breakpoint
CREATE INDEX `client_provider_connections_provider_idx` ON `client_provider_connections` (`provider`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `provider_publish_jobs` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `client_id` varchar(36) NOT NULL,
  `campaign_id` varchar(36) NOT NULL,
  `campaign_post_id` varchar(36) NOT NULL,
  `asset_id` varchar(36),
  `connection_id` varchar(36) NOT NULL,
  `provider` varchar(32) NOT NULL,
  `target_platform` varchar(48) NOT NULL,
  `caption` text NOT NULL,
  `hashtags` varchar(1000),
  `scheduled_at` timestamp NOT NULL,
  `timezone` varchar(64) NOT NULL,
  `provider_payload_json` json,
  `provider_response_json` json,
  `status` varchar(32) NOT NULL DEFAULT 'scheduled',
  `error_message` text,
  `attempts` int NOT NULL DEFAULT 0,
  `last_attempt_at` timestamp NULL,
  `external_schedule_id` varchar(120),
  `external_post_id` varchar(120),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `provider_publish_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `provider_publish_jobs_client_id_idx` ON `provider_publish_jobs` (`client_id`);
--> statement-breakpoint
CREATE INDEX `provider_publish_jobs_user_id_idx` ON `provider_publish_jobs` (`user_id`);
--> statement-breakpoint
CREATE INDEX `provider_publish_jobs_provider_idx` ON `provider_publish_jobs` (`provider`);
--> statement-breakpoint
CREATE INDEX `provider_publish_jobs_campaign_id_idx` ON `provider_publish_jobs` (`campaign_id`);
--> statement-breakpoint
CREATE INDEX `provider_publish_jobs_campaign_post_id_idx` ON `provider_publish_jobs` (`campaign_post_id`);
--> statement-breakpoint
CREATE INDEX `provider_publish_jobs_status_idx` ON `provider_publish_jobs` (`status`);
--> statement-breakpoint
CREATE INDEX `provider_publish_jobs_scheduled_at_idx` ON `provider_publish_jobs` (`scheduled_at`);
--> statement-breakpoint
CREATE INDEX `provider_publish_jobs_connection_id_idx` ON `provider_publish_jobs` (`connection_id`);
