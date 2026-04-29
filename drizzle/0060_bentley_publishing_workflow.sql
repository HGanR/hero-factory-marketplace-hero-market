-- Bentley Phase 6: publishing lifecycle + lead handoffs

ALTER TABLE `bentley_distribution_queue`
  ADD COLUMN IF NOT EXISTS `approval_status` varchar(32) NOT NULL DEFAULT 'pending';

ALTER TABLE `bentley_distribution_queue`
  ADD COLUMN IF NOT EXISTS `publish_attempt_count` int NOT NULL DEFAULT 0;

ALTER TABLE `bentley_distribution_queue`
  ADD COLUMN IF NOT EXISTS `last_publish_error` text NULL DEFAULT NULL;

ALTER TABLE `bentley_distribution_queue`
  ADD COLUMN IF NOT EXISTS `external_post_ref` varchar(512) NULL DEFAULT NULL;

ALTER TABLE `bentley_distribution_queue`
  ADD COLUMN IF NOT EXISTS `last_synced_at` timestamp NULL DEFAULT NULL;

ALTER TABLE `bentley_distribution_queue`
  ADD COLUMN IF NOT EXISTS `performance_sync_status` varchar(64) NULL DEFAULT NULL;

ALTER TABLE `bentley_distribution_queue`
  ADD COLUMN IF NOT EXISTS `lead_handoff_status` varchar(64) NULL DEFAULT NULL;

ALTER TABLE `bentley_distribution_queue`
  ADD COLUMN IF NOT EXISTS `workflow_note` text NULL DEFAULT NULL;

CREATE TABLE IF NOT EXISTS `bentley_lead_handoffs` (
  `id` varchar(36) NOT NULL,
  `lead_signal_id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `client_id` varchar(36) NOT NULL DEFAULT '',
  `trust_id` varchar(36) NOT NULL DEFAULT '',
  `handoff_status` varchar(32) NOT NULL DEFAULT 'new',
  `owner_user_id` varchar(64) NULL DEFAULT NULL,
  `handoff_note` text NULL DEFAULT NULL,
  `recommended_followup` varchar(512) NOT NULL DEFAULT '',
  `bentley_next_response_mode` varchar(128) NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `blh_signal_status` (`lead_signal_id`, `handoff_status`),
  KEY `blh_user_created` (`user_id`, `created_at`),
  KEY `blh_workspace` (`user_id`, `client_id`, `trust_id`, `handoff_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
