-- Bentley: persisted explainability / decision simulation snapshots (audit + UI replay).
-- Restored after file was emptied; if TiDB already applied, align checksum only.

CREATE TABLE IF NOT EXISTS `bentley_explainability_snapshots` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `client_id` varchar(36) NULL,
  `trust_id` varchar(36) NULL,
  `snapshot_type` varchar(48) NOT NULL DEFAULT 'decision_explanation',
  `input_json` json NULL,
  `output_json` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bes_user_created` (`user_id`, `created_at`),
  KEY `bes_scope` (`user_id`, `client_id`, `trust_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
