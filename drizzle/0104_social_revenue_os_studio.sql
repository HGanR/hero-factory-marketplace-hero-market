-- AI Revenue OS: native social asset studio + per-platform variants (v1 scaffold).
-- Idempotent: safe to re-run.

SET @db = DATABASE();

-- ---------------------------------------------------------------------------
-- social_generation_runs: one row per “generate pack” (captions + native image).
-- ---------------------------------------------------------------------------
SET @sgr := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'social_generation_runs'
);
SET @ddl_sgr := IF(
  @sgr > 0,
  'SELECT 1 AS `_skip_social_generation_runs`',
  'CREATE TABLE `social_generation_runs` (
    `id` varchar(36) NOT NULL,
    `user_id` varchar(64) NOT NULL,
    `client_id` varchar(36) NOT NULL DEFAULT \'\',
    `campaign_id` varchar(36) NOT NULL,
    `status` varchar(24) NOT NULL DEFAULT \'complete\',
    `topic` text,
    `source_prompt` text,
    `metadata_json` json,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `socgen_user_campaign_idx` (`user_id`, `campaign_id`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
PREPARE _mig_0104_sgr FROM @ddl_sgr;
EXECUTE _mig_0104_sgr;
DEALLOCATE PREPARE _mig_0104_sgr;

-- ---------------------------------------------------------------------------
-- social_media_assets: generated or selected creative metadata (+ optional URL).
-- ---------------------------------------------------------------------------
SET @sma := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'social_media_assets'
);
SET @ddl_sma := IF(
  @sma > 0,
  'SELECT 1 AS `_skip_social_media_assets`',
  'CREATE TABLE `social_media_assets` (
    `id` varchar(36) NOT NULL,
    `user_id` varchar(64) NOT NULL,
    `client_id` varchar(36) NOT NULL DEFAULT \'\',
    `campaign_id` varchar(36) NOT NULL,
    `generation_run_id` varchar(36) NULL,
    `asset_type` varchar(32) NOT NULL DEFAULT \'image\',
    `source_prompt` text,
    `platform_targets_json` json,
    `generation_metadata_json` json,
    `width` int NULL,
    `height` int NULL,
    `aspect_ratio` varchar(32) NULL,
    `storage_url` varchar(1024) NULL,
    `storage_kind` varchar(24) NULL,
    `selected` tinyint(1) NOT NULL DEFAULT 0,
    `export_status` varchar(24) NOT NULL DEFAULT \'none\',
    `campaign_asset_id` varchar(36) NULL,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `socma_campaign_idx` (`campaign_id`),
    KEY `socma_run_idx` (`generation_run_id`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
PREPARE _mig_0104_sma FROM @ddl_sma;
EXECUTE _mig_0104_sma;
DEALLOCATE PREPARE _mig_0104_sma;

-- ---------------------------------------------------------------------------
-- social_post_platform_variants: per-network caption (and image prompt) before
-- a row is promoted to `campaign_posts` (governed composer source of truth).
-- ---------------------------------------------------------------------------
SET @spv := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'social_post_platform_variants'
);
SET @ddl_spv := IF(
  @spv > 0,
  'SELECT 1 AS `_skip_social_post_platform_variants`',
  'CREATE TABLE `social_post_platform_variants` (
    `id` varchar(36) NOT NULL,
    `user_id` varchar(64) NOT NULL,
    `client_id` varchar(36) NOT NULL DEFAULT \'\',
    `campaign_id` varchar(36) NOT NULL,
    `generation_run_id` varchar(36) NULL,
    `campaign_post_id` varchar(36) NULL,
    `platform` varchar(24) NOT NULL,
    `caption` text,
    `hashtags` varchar(1000) NULL,
    `link_url` varchar(512) NULL,
    `image_prompt` text NULL,
    `social_media_asset_id` varchar(36) NULL,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `soppv_campaign_idx` (`campaign_id`),
    KEY `soppv_post_idx` (`campaign_post_id`),
    KEY `soppv_run_idx` (`generation_run_id`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
PREPARE _mig_0104_spv FROM @ddl_spv;
EXECUTE _mig_0104_spv;
DEALLOCATE PREPARE _mig_0104_spv;

-- ---------------------------------------------------------------------------
-- social_account_capabilities: optional DB overrides; null flags_json = code defaults.
-- ---------------------------------------------------------------------------
SET @sac := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'social_account_capabilities'
);
SET @ddl_sac := IF(
  @sac > 0,
  'SELECT 1 AS `_skip_social_account_capabilities`',
  'CREATE TABLE `social_account_capabilities` (
    `social_account_id` varchar(36) NOT NULL,
    `flags_json` json,
    `default_destination` varchar(512) NULL,
    `last_capability_sync_at` timestamp NULL,
    `settings_json` json,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`social_account_id`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
PREPARE _mig_0104_sac FROM @ddl_sac;
EXECUTE _mig_0104_sac;
DEALLOCATE PREPARE _mig_0104_sac;
