-- Bentley: explicit rollback packages + governed apply runs (does not auto-apply)

CREATE TABLE IF NOT EXISTS `bentley_policy_rollback_packages` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `source_rollout_plan_id` varchar(36) NULL DEFAULT NULL,
  `source_scenario_id` varchar(36) NULL DEFAULT NULL,
  `rollback_type` varchar(32) NOT NULL DEFAULT 'blended',
  `name` varchar(255) NOT NULL DEFAULT '',
  `current_policy_snapshot_json` json NULL,
  `rollback_target_snapshot_json` json NULL,
  `delta_json` json NULL,
  `rationale_json` json NULL,
  `is_saved` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bprbp_user_updated` (`user_id`, `updated_at`),
  CONSTRAINT `bprbp_rollout_fk` FOREIGN KEY (`source_rollout_plan_id`) REFERENCES `bentley_policy_rollout_plans` (`id`) ON DELETE SET NULL,
  CONSTRAINT `bprbp_scenario_fk` FOREIGN KEY (`source_scenario_id`) REFERENCES `bentley_policy_scenarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bentley_policy_rollback_runs` (
  `id` varchar(36) NOT NULL,
  `rollback_package_id` varchar(36) NOT NULL,
  `run_status` varchar(24) NOT NULL DEFAULT 'prepared',
  `run_summary_json` json NULL,
  `reviewed_by_user_id` varchar(64) NULL DEFAULT NULL,
  `applied_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bprbr_pkg_created` (`rollback_package_id`, `created_at`),
  CONSTRAINT `bprbr_pkg_fk` FOREIGN KEY (`rollback_package_id`) REFERENCES `bentley_policy_rollback_packages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
