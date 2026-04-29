-- Part 4 — Smart Inbox foundation (additive engagement threads / messages / labels / assignments / AI suggestions)

SET @db := DATABASE();

-- ---------------------------------------------------------------------------
-- social_engagement_threads
-- ---------------------------------------------------------------------------
SET @set := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'social_engagement_threads'
);
SET @ddl := IF(
  @set > 0,
  'SELECT 1',
  'CREATE TABLE `social_engagement_threads` (
    `id` varchar(36) NOT NULL,
    `user_id` varchar(64) NOT NULL,
    `client_id` varchar(36) NOT NULL DEFAULT \'\',
    `campaign_id` varchar(36) NULL,
    `social_account_id` varchar(36) NOT NULL,
    `provider` varchar(32) NOT NULL,
    `external_thread_id` varchar(512) NOT NULL,
    `source_type` varchar(32) NOT NULL,
    `status` varchar(32) NOT NULL DEFAULT \'new\',
    `intent` varchar(64) NULL,
    `sentiment` varchar(32) NULL,
    `urgency` varchar(32) NULL,
    `requires_manual` tinyint(1) NOT NULL DEFAULT 0,
    `last_message_at` timestamp NULL,
    `metadata_json` json,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `eng_th_ext_uq` (`social_account_id`, `external_thread_id`),
    KEY `eng_th_user_client` (`user_id`, `client_id`),
    KEY `eng_th_acc_status` (`social_account_id`, `status`),
    KEY `eng_th_provider_status` (`provider`, `status`),
    KEY `eng_th_last_msg` (`last_message_at`),
    KEY `eng_th_campaign` (`campaign_id`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------------------------------------
-- social_engagement_messages
-- ---------------------------------------------------------------------------
SET @set2 := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'social_engagement_messages'
);
SET @ddl2 := IF(
  @set2 > 0,
  'SELECT 1',
  'CREATE TABLE `social_engagement_messages` (
    `id` varchar(36) NOT NULL,
    `thread_id` varchar(36) NOT NULL,
    `external_message_id` varchar(512) NOT NULL,
    `direction` varchar(32) NOT NULL,
    `author_display` varchar(512) NULL,
    `message_text` text,
    `raw_payload_json` json,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `eng_msg_ext_uq` (`thread_id`, `external_message_id`),
    KEY `eng_msg_thread_created` (`thread_id`, `created_at`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
PREPARE s2 FROM @ddl2; EXECUTE s2; DEALLOCATE PREPARE s2;

-- ---------------------------------------------------------------------------
-- social_engagement_labels (per-client catalog)
-- ---------------------------------------------------------------------------
SET @set3 := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'social_engagement_labels'
);
SET @ddl3 := IF(
  @set3 > 0,
  'SELECT 1',
  'CREATE TABLE `social_engagement_labels` (
    `id` varchar(36) NOT NULL,
    `user_id` varchar(64) NOT NULL,
    `client_id` varchar(36) NOT NULL DEFAULT \'\',
    `slug` varchar(64) NOT NULL,
    `display_name` varchar(160) NOT NULL,
    `color_hex` varchar(16) NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `eng_lbl_client_slug` (`client_id`, `slug`),
    KEY `eng_lbl_user` (`user_id`, `client_id`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
PREPARE s3 FROM @ddl3; EXECUTE s3; DEALLOCATE PREPARE s3;

-- ---------------------------------------------------------------------------
-- social_engagement_thread_labels (junction)
-- ---------------------------------------------------------------------------
SET @set4 := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'social_engagement_thread_labels'
);
SET @ddl4 := IF(
  @set4 > 0,
  'SELECT 1',
  'CREATE TABLE `social_engagement_thread_labels` (
    `thread_id` varchar(36) NOT NULL,
    `label_id` varchar(36) NOT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`thread_id`, `label_id`),
    KEY `eng_tjl_label` (`label_id`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
PREPARE s4 FROM @ddl4; EXECUTE s4; DEALLOCATE PREPARE s4;

-- ---------------------------------------------------------------------------
-- social_engagement_assignments
-- ---------------------------------------------------------------------------
SET @set5 := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'social_engagement_assignments'
);
SET @ddl5 := IF(
  @set5 > 0,
  'SELECT 1',
  'CREATE TABLE `social_engagement_assignments` (
    `id` varchar(36) NOT NULL,
    `thread_id` varchar(36) NOT NULL,
    `assigned_user_id` varchar(64) NOT NULL,
    `assigned_role` varchar(64) NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `eng_asn_thread` (`thread_id`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
PREPARE s5 FROM @ddl5; EXECUTE s5; DEALLOCATE PREPARE s5;

-- ---------------------------------------------------------------------------
-- social_engagement_ai_suggestions
-- ---------------------------------------------------------------------------
SET @set6 := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'social_engagement_ai_suggestions'
);
SET @ddl6 := IF(
  @set6 > 0,
  'SELECT 1',
  'CREATE TABLE `social_engagement_ai_suggestions` (
    `id` varchar(36) NOT NULL,
    `thread_id` varchar(36) NOT NULL,
    `suggestion_type` varchar(32) NOT NULL,
    `suggested_text` text,
    `rationale_json` json,
    `status` varchar(32) NOT NULL DEFAULT \'pending\',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `eng_ai_thread` (`thread_id`, `status`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
PREPARE s6 FROM @ddl6; EXECUTE s6; DEALLOCATE PREPARE s6;
