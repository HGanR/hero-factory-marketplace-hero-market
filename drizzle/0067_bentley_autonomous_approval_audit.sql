-- Bentley: approval queue + autonomous action audit trail

CREATE TABLE IF NOT EXISTS `bentley_autonomous_approval_requests` (
  `id` varchar(36) NOT NULL,
  `autonomous_run_id` varchar(36) NULL DEFAULT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `client_id` varchar(36) NOT NULL DEFAULT '',
  `trust_id` varchar(36) NOT NULL DEFAULT '',
  `action_type` varchar(64) NOT NULL DEFAULT '',
  `approval_status` varchar(24) NOT NULL DEFAULT 'pending',
  `severity` varchar(24) NOT NULL DEFAULT 'info',
  `reason` text,
  `rationale_json` json NULL,
  `decision_payload_json` json NULL,
  `target_ids_json` json NULL,
  `requested_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `reviewed_by_user_id` varchar(64) NULL DEFAULT NULL,
  `review_note` varchar(2000) NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `baar_user_status` (`user_id`, `approval_status`, `requested_at`),
  KEY `baar_run` (`autonomous_run_id`),
  KEY `baar_scope` (`user_id`, `client_id`, `trust_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bentley_autonomous_action_audit` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `client_id` varchar(36) NOT NULL DEFAULT '',
  `trust_id` varchar(36) NOT NULL DEFAULT '',
  `source_type` varchar(48) NOT NULL DEFAULT 'autonomous_engine',
  `action_type` varchar(64) NOT NULL DEFAULT '',
  `action_status` varchar(32) NOT NULL DEFAULT 'planned',
  `related_run_id` varchar(36) NULL DEFAULT NULL,
  `related_approval_request_id` varchar(36) NULL DEFAULT NULL,
  `target_ids_json` json NULL,
  `action_payload_json` json NULL,
  `result_payload_json` json NULL,
  `rationale_json` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `baaa_user_created` (`user_id`, `created_at`),
  KEY `baaa_user_status` (`user_id`, `action_status`, `created_at`),
  KEY `baaa_approval` (`related_approval_request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
