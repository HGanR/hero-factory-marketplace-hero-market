-- Bentley: coordinated policy change sets + deployment runs (orchestration layer)

CREATE TABLE IF NOT EXISTS `bentley_policy_change_sets` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `source_scenario_id` varchar(36) NULL DEFAULT NULL,
  `source_rollout_plan_id` varchar(36) NULL DEFAULT NULL,
  `source_rollback_package_id` varchar(36) NULL DEFAULT NULL,
  `name` varchar(255) NOT NULL DEFAULT '',
  `description` text NULL,
  `change_set_type` varchar(32) NOT NULL DEFAULT 'blended_update',
  `scope_json` json NULL,
  `status` varchar(32) NOT NULL DEFAULT 'draft',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bpcs_user_updated` (`user_id`, `updated_at`),
  CONSTRAINT `bpcs_scenario_fk` FOREIGN KEY (`source_scenario_id`) REFERENCES `bentley_policy_scenarios` (`id`) ON DELETE SET NULL,
  CONSTRAINT `bpcs_rollout_fk` FOREIGN KEY (`source_rollout_plan_id`) REFERENCES `bentley_policy_rollout_plans` (`id`) ON DELETE SET NULL,
  CONSTRAINT `bpcs_rollback_pkg_fk` FOREIGN KEY (`source_rollback_package_id`) REFERENCES `bentley_policy_rollback_packages` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bentley_policy_change_set_items` (
  `id` varchar(36) NOT NULL,
  `change_set_id` varchar(36) NOT NULL,
  `policy_family` varchar(24) NOT NULL,
  `item_order` int NOT NULL DEFAULT 0,
  `item_status` varchar(24) NOT NULL DEFAULT 'pending',
  `target_scope_json` json NULL,
  `payload_json` json NULL,
  `result_json` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bpcsi_set_order` (`change_set_id`, `item_order`),
  CONSTRAINT `bpcsi_cs_fk` FOREIGN KEY (`change_set_id`) REFERENCES `bentley_policy_change_sets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bentley_policy_change_set_runs` (
  `id` varchar(36) NOT NULL,
  `change_set_id` varchar(36) NOT NULL,
  `run_status` varchar(24) NOT NULL DEFAULT 'started',
  `run_summary_json` json NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bpcsr_set_created` (`change_set_id`, `created_at`),
  CONSTRAINT `bpcsr_cs_fk` FOREIGN KEY (`change_set_id`) REFERENCES `bentley_policy_change_sets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
