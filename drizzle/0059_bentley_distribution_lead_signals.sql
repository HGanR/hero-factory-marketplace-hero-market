-- Phase 5: distribution queue + extracted lead signals (6060+ ALTER this queue; 6061 adds routing columns on targets).
-- Restored after file was emptied; if TiDB already applied, align checksum only.

CREATE TABLE IF NOT EXISTS `bentley_distribution_queue` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `client_id` varchar(36) NOT NULL DEFAULT '',
  `trust_id` varchar(36) NOT NULL DEFAULT '',
  `experiment_id` varchar(36) NULL,
  `experiment_variant_id` varchar(36) NULL,
  `market_sweep_snapshot_id` varchar(36) NULL,
  `content_deployment_id` varchar(36) NULL,
  `title` varchar(512) NOT NULL DEFAULT '',
  `platform` varchar(64) NOT NULL DEFAULT '',
  `content_type` varchar(64) NOT NULL DEFAULT '',
  `queue_status` varchar(24) NOT NULL DEFAULT 'draft',
  `scheduled_for` timestamp NULL,
  `published_at` timestamp NULL,
  `publish_priority` int NULL,
  `winning_signal_source` varchar(128) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bdq_user_status_created` (`user_id`, `queue_status`, `created_at`),
  KEY `bdq_experiment` (`experiment_id`),
  KEY `bdq_snapshot` (`market_sweep_snapshot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bentley_distribution_queue_targets` (
  `id` varchar(36) NOT NULL,
  `queue_id` varchar(36) NOT NULL,
  `target_platform` varchar(64) NOT NULL DEFAULT '',
  `target_profile_id` varchar(64) NULL,
  `target_format` varchar(64) NOT NULL DEFAULT '',
  `payload_json` json NULL,
  `target_status` varchar(24) NOT NULL DEFAULT 'draft',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bdqt_queue` (`queue_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bentley_lead_signals` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `client_id` varchar(36) NOT NULL DEFAULT '',
  `trust_id` varchar(36) NOT NULL DEFAULT '',
  `source_platform` varchar(64) NOT NULL DEFAULT '',
  `source_type` varchar(48) NOT NULL DEFAULT 'comment',
  `source_ref` varchar(512) NULL,
  `topic` varchar(256) NULL,
  `hook_type` varchar(64) NULL,
  `angle` varchar(512) NULL,
  `sentiment_score` decimal(8,4) NULL,
  `commercial_intent_score` decimal(8,4) NULL,
  `urgency_score` decimal(8,4) NULL,
  `handoff_readiness` decimal(8,4) NULL,
  `extracted_text` text NOT NULL,
  `extracted_entities_json` json NULL,
  `recommended_followup` varchar(512) NOT NULL DEFAULT '',
  `experiment_id` varchar(36) NULL,
  `experiment_variant_id` varchar(36) NULL,
  `signal_class` varchar(48) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bls_user_created` (`user_id`, `created_at`),
  KEY `bls_workspace` (`user_id`, `client_id`, `trust_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
