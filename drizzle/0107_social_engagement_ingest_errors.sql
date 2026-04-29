-- Part 7 — Persisted provider / ingest error fingerprints (additive, upserted by user + fingerprint)

SET @db := DATABASE();

SET @set := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'social_engagement_ingest_errors'
);
SET @ddl := IF(
  @set > 0,
  'SELECT 1',
  'CREATE TABLE `social_engagement_ingest_errors` (
    `id` varchar(36) NOT NULL,
    `user_id` varchar(64) NOT NULL,
    `fingerprint` varchar(64) NOT NULL,
    `provider` varchar(32) NOT NULL,
    `social_account_id` varchar(36) NULL,
    `client_id` varchar(36) NOT NULL DEFAULT \'\',
    `error_code` varchar(64) NOT NULL,
    `error_message` text NOT NULL,
    `context_json` json NULL,
    `first_seen_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `last_seen_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `count` int NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    UNIQUE KEY `ing_err_fp_uq` (`user_id`, `fingerprint`),
    KEY `ing_err_client_seen` (`user_id`, `client_id`, `last_seen_at`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
