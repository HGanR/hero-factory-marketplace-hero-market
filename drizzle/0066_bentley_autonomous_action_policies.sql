-- Bentley: policy-governed autonomous operator actions

CREATE TABLE IF NOT EXISTS `bentley_autonomous_action_policies` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `client_id` varchar(36) NOT NULL DEFAULT '',
  `trust_id` varchar(36) NOT NULL DEFAULT '',
  `action_type` varchar(64) NOT NULL DEFAULT 'auto_retry_failed_publish',
  `is_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `requires_approval_above_severity` varchar(24) NOT NULL DEFAULT 'none',
  `max_daily_executions` int NULL DEFAULT NULL,
  `cooldown_minutes` int NULL DEFAULT NULL,
  `policy_config_json` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `baap_user_action` (`user_id`, `action_type`, `is_enabled`),
  KEY `baap_user_scope` (`user_id`, `client_id`, `trust_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bentley_autonomous_action_runs` (
  `id` varchar(36) NOT NULL,
  `policy_id` varchar(36) NOT NULL,
  `action_type` varchar(64) NOT NULL DEFAULT '',
  `run_status` varchar(24) NOT NULL DEFAULT 'started',
  `scope_json` json NULL,
  `decision_summary_json` json NULL,
  `executed_count` int NOT NULL DEFAULT 0,
  `skipped_count` int NOT NULL DEFAULT 0,
  `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `baar_policy_started` (`policy_id`, `started_at`),
  KEY `baar_status_started` (`run_status`, `started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
