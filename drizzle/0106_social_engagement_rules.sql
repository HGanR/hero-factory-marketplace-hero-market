-- Part 5 — Engagement rules + idempotent rule applications (additive)

SET @db := DATABASE();

-- ---------------------------------------------------------------------------
-- social_engagement_rules
-- ---------------------------------------------------------------------------
SET @set := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'social_engagement_rules'
);
SET @ddl := IF(
  @set > 0,
  'SELECT 1',
  'CREATE TABLE `social_engagement_rules` (
    `id` varchar(36) NOT NULL,
    `user_id` varchar(64) NOT NULL,
    `client_id` varchar(36) NOT NULL DEFAULT \'\',
    `name` varchar(200) NOT NULL,
    `conditions_json` json NOT NULL,
    `actions_json` json NOT NULL,
    `is_active` tinyint(1) NOT NULL DEFAULT 1,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `eng_rules_client` (`client_id`, `is_active`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------------------------------------
-- social_engagement_rule_applications (idempotency: one row per thread+rule)
-- ---------------------------------------------------------------------------
SET @set2 := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'social_engagement_rule_applications'
);
SET @ddl2 := IF(
  @set2 > 0,
  'SELECT 1',
  'CREATE TABLE `social_engagement_rule_applications` (
    `id` varchar(36) NOT NULL,
    `thread_id` varchar(36) NOT NULL,
    `rule_id` varchar(36) NOT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `eng_rule_app_uq` (`thread_id`, `rule_id`),
    KEY `eng_rule_app_rule` (`rule_id`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
PREPARE s2 FROM @ddl2; EXECUTE s2; DEALLOCATE PREPARE s2;
