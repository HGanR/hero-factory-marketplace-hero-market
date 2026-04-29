-- Bentley notification routing + events + deliveries (`0083` adds `read_at` on `bentley_notification_events`).
-- Restored after file was emptied; if TiDB already applied, align checksum only.

CREATE TABLE IF NOT EXISTS `bentley_notification_channels` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `channel_type` varchar(48) NOT NULL DEFAULT 'in_app',
  `channel_label` varchar(256) NOT NULL DEFAULT '',
  `channel_config_json` json NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bnc_user_type` (`user_id`, `channel_type`, `is_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bentley_notification_policies` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `client_id` varchar(36) NOT NULL DEFAULT '',
  `trust_id` varchar(36) NOT NULL DEFAULT '',
  `event_type` varchar(96) NOT NULL DEFAULT '',
  `minimum_severity` varchar(24) NOT NULL DEFAULT 'info',
  `channel_id` varchar(36) NOT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `policy_config_json` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bnp_user_scope` (`user_id`, `client_id`, `trust_id`),
  KEY `bnp_event` (`user_id`, `event_type`, `is_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bentley_notification_events` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `client_id` varchar(36) NOT NULL DEFAULT '',
  `trust_id` varchar(36) NOT NULL DEFAULT '',
  `source_type` varchar(48) NOT NULL DEFAULT 'bentley_engine',
  `event_type` varchar(96) NOT NULL DEFAULT '',
  `severity` varchar(24) NOT NULL DEFAULT 'info',
  `title` varchar(512) NOT NULL DEFAULT '',
  `body` text NULL,
  `event_payload_json` json NULL,
  `dedupe_key` varchar(191) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bne_user_created` (`user_id`, `created_at`),
  KEY `bne_user_dedupe` (`user_id`, `dedupe_key`),
  KEY `bne_scope` (`user_id`, `client_id`, `trust_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bentley_notification_deliveries` (
  `id` varchar(36) NOT NULL,
  `event_id` varchar(36) NOT NULL,
  `channel_id` varchar(36) NOT NULL,
  `delivery_status` varchar(24) NOT NULL DEFAULT 'pending',
  `delivery_attempt_count` int NOT NULL DEFAULT 0,
  `last_delivery_error` varchar(1024) NULL,
  `delivered_at` timestamp NULL,
  `read_at` timestamp NULL,
  `delivery_payload_json` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bnd_event` (`event_id`),
  KEY `bnd_channel_status` (`channel_id`, `delivery_status`),
  KEY `bnd_read` (`channel_id`, `read_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
