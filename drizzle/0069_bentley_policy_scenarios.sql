-- Bentley: policy tuning workbench — saved scenarios and dry-run run outputs

CREATE TABLE IF NOT EXISTS `bentley_policy_scenarios` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `client_id` varchar(36) NULL DEFAULT NULL,
  `trust_id` varchar(36) NULL DEFAULT NULL,
  `scenario_type` varchar(32) NOT NULL DEFAULT 'blended',
  `name` varchar(255) NOT NULL DEFAULT '',
  `description` text NULL,
  `base_policy_snapshot_json` json NULL,
  `proposed_policy_snapshot_json` json NULL,
  `is_saved` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bps_user_updated` (`user_id`, `updated_at`),
  KEY `bps_scope` (`user_id`, `client_id`, `trust_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bentley_policy_scenario_runs` (
  `id` varchar(36) NOT NULL,
  `scenario_id` varchar(36) NOT NULL,
  `run_status` varchar(24) NOT NULL DEFAULT 'completed',
  `comparison_json` json NULL,
  `risk_summary_json` json NULL,
  `recommendation_json` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bpsr_scenario_created` (`scenario_id`, `created_at`),
  CONSTRAINT `bpsr_scenario_fk` FOREIGN KEY (`scenario_id`) REFERENCES `bentley_policy_scenarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
