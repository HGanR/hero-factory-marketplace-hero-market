-- Bentley: rollout execution monitoring + stage checks (operational state only — no live policy mutation)

ALTER TABLE `bentley_policy_rollout_runs`
  ADD COLUMN `active_stage_index` int NULL DEFAULT NULL,
  ADD COLUMN `stage_status` varchar(32) NULL DEFAULT NULL,
  ADD COLUMN `stage_progress_json` json NULL,
  ADD COLUMN `monitoring_summary_json` json NULL,
  ADD COLUMN `recommended_action` varchar(64) NULL DEFAULT NULL,
  ADD COLUMN `rollback_triggered_at` timestamp NULL DEFAULT NULL;

CREATE TABLE IF NOT EXISTS `bentley_policy_rollout_stage_checks` (
  `id` varchar(36) NOT NULL,
  `rollout_run_id` varchar(36) NOT NULL,
  `stage_index` int NOT NULL DEFAULT 0,
  `check_status` varchar(24) NOT NULL DEFAULT 'healthy',
  `observed_metrics_json` json NULL,
  `trigger_breaches_json` json NULL,
  `success_progress_json` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bprsc_run_stage` (`rollout_run_id`, `stage_index`, `created_at`),
  CONSTRAINT `bprsc_run_fk` FOREIGN KEY (`rollout_run_id`) REFERENCES `bentley_policy_rollout_runs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
