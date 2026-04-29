-- Bentley: autonomous cadence + optimization scheduler

CREATE TABLE IF NOT EXISTS `bentley_cadence_runs` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `client_id` varchar(36) NOT NULL DEFAULT '',
  `trust_id` varchar(36) NOT NULL DEFAULT '',
  `run_type` varchar(48) NOT NULL DEFAULT 'daily_refresh',
  `run_status` varchar(24) NOT NULL DEFAULT 'started',
  `run_summary_json` json NULL,
  `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bcr_user_started` (`user_id`, `started_at`),
  KEY `bcr_workspace` (`user_id`, `client_id`, `trust_id`, `started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `bentley_distribution_queue`
  ADD COLUMN IF NOT EXISTS `cadence_priority` int NULL DEFAULT NULL;

ALTER TABLE `bentley_distribution_queue`
  ADD COLUMN IF NOT EXISTS `stale_after_at` timestamp NULL DEFAULT NULL;

ALTER TABLE `bentley_distribution_queue`
  ADD COLUMN IF NOT EXISTS `last_optimization_action` varchar(64) NULL DEFAULT NULL;

ALTER TABLE `bentley_distribution_queue`
  ADD COLUMN IF NOT EXISTS `suppression_reason` varchar(512) NULL DEFAULT NULL;

ALTER TABLE `bentley_distribution_queue`
  ADD COLUMN IF NOT EXISTS `promotion_reason` varchar(512) NULL DEFAULT NULL;

ALTER TABLE `bentley_distribution_queue`
  ADD COLUMN IF NOT EXISTS `retest_eligible_at` timestamp NULL DEFAULT NULL;
