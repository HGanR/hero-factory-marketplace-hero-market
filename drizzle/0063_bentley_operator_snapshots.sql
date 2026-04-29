-- Bentley: operator command center snapshots (optional persistence)

CREATE TABLE IF NOT EXISTS `bentley_operator_snapshots` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `snapshot_type` varchar(48) NOT NULL DEFAULT 'workspace_summary',
  `scope_json` json NULL,
  `summary_json` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bos_user_created` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
