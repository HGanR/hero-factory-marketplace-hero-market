-- Hybrid Bentley: persisted market sweep snapshots + operator feedback log.
-- Restored after file was emptied; if already applied on TiDB, align checksum only.

CREATE TABLE IF NOT EXISTS `market_intelligence_snapshots` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `client_id` varchar(36) NOT NULL DEFAULT '',
  `trust_id` varchar(36) NOT NULL DEFAULT '',
  `industry` varchar(200) NOT NULL,
  `target_audience` varchar(300) NOT NULL DEFAULT '',
  `query_fingerprint` varchar(64) NOT NULL DEFAULT '',
  `real_signals` json,
  `merged_result` json,
  `scored_signals` json,
  `decision_hint` varchar(64),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `mkt_intel_snap_user_created` (`user_id`, `created_at`),
  KEY `mkt_intel_snap_industry` (`industry`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `content_feedback_log` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `client_id` varchar(36) NOT NULL DEFAULT '',
  `trust_id` varchar(36) NOT NULL DEFAULT '',
  `source` varchar(32) NOT NULL DEFAULT 'manual',
  `campaign_id` varchar(36),
  `platform` varchar(64),
  `sentiment` varchar(24),
  `score_delta` decimal(8,4),
  `raw_payload` json,
  `notes` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `cfb_user_created` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
