-- Bentley: automation policies + run audit trail

CREATE TABLE IF NOT EXISTS `bentley_automation_policies` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `client_id` varchar(36) NOT NULL DEFAULT '',
  `trust_id` varchar(36) NOT NULL DEFAULT '',
  `policy_type` varchar(64) NOT NULL DEFAULT 'daily_operator_summary',
  `is_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `schedule_json` json NULL,
  `policy_config_json` json NULL,
  `last_run_at` timestamp NULL DEFAULT NULL,
  `next_run_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bap_user_enabled_next` (`user_id`, `is_enabled`, `next_run_at`),
  KEY `bap_user_scope` (`user_id`, `client_id`, `trust_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bentley_automation_runs` (
  `id` varchar(36) NOT NULL,
  `policy_id` varchar(36) NOT NULL,
  `run_status` varchar(24) NOT NULL DEFAULT 'started',
  `run_summary_json` json NULL,
  `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bar_policy_started` (`policy_id`, `started_at`),
  KEY `bar_started` (`started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
