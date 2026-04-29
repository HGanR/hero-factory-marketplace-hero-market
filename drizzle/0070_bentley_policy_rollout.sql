-- Bentley: staged policy rollout plans (coaching + guardrails; does not apply live policies)

CREATE TABLE IF NOT EXISTS `bentley_policy_rollout_plans` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `rollout_type` varchar(32) NOT NULL DEFAULT 'blended',
  `source_scenario_id` varchar(36) NULL DEFAULT NULL,
  `name` varchar(255) NOT NULL DEFAULT '',
  `scope_json` json NULL,
  `rollout_strategy_json` json NULL,
  `guardrails_json` json NULL,
  `rollback_plan_json` json NULL,
  `is_saved` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bprp_user_updated` (`user_id`, `updated_at`),
  KEY `bprp_scope` (`user_id`),
  CONSTRAINT `bprp_scenario_fk` FOREIGN KEY (`source_scenario_id`) REFERENCES `bentley_policy_scenarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bentley_policy_rollout_runs` (
  `id` varchar(36) NOT NULL,
  `rollout_plan_id` varchar(36) NOT NULL,
  `run_status` varchar(24) NOT NULL DEFAULT 'planned',
  `run_summary_json` json NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bprr_plan_created` (`rollout_plan_id`, `created_at`),
  CONSTRAINT `bprr_plan_fk` FOREIGN KEY (`rollout_plan_id`) REFERENCES `bentley_policy_rollout_plans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
