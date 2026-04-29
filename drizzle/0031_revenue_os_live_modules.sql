-- Revenue OS: persistence for Market Intelligence, Offer Engineering, Capital, Experiments
-- Run against TiDB/MySQL after backup. Idempotent where supported.

CREATE TABLE IF NOT EXISTS `offer_packages` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `client_id` VARCHAR(36) NOT NULL DEFAULT '',
  `trust_id` VARCHAR(36) NOT NULL DEFAULT '',
  `profile_id` VARCHAR(36),
  `name` VARCHAR(200) NOT NULL DEFAULT 'Revenue ladder',
  `industry_key` VARCHAR(120),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `offer_pkg_workspace_idx` (`user_id`, `client_id`, `trust_id`),
  KEY `offer_pkg_user_idx` (`user_id`)
);

CREATE TABLE IF NOT EXISTS `offer_versions` (
  `id` VARCHAR(36) NOT NULL,
  `package_id` VARCHAR(36) NOT NULL,
  `version` INT NOT NULL,
  `offer_ladder` JSON NOT NULL,
  `pricing_bands` JSON NOT NULL,
  `upsells` JSON NOT NULL,
  `target_monthly_revenue` DECIMAL(18,2),
  `margin_pct` DECIMAL(7,4),
  `raw_payload` JSON,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `offer_ver_pkg_ver_uidx` (`package_id`, `version`),
  KEY `offer_ver_pkg_idx` (`package_id`)
);

CREATE TABLE IF NOT EXISTS `experiment_variants` (
  `id` VARCHAR(36) NOT NULL,
  `experiment_id` VARCHAR(36) NOT NULL,
  `label` VARCHAR(64) NOT NULL,
  `is_control` TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `exp_var_exp_idx` (`experiment_id`)
);

CREATE TABLE IF NOT EXISTS `experiment_results` (
  `id` VARCHAR(36) NOT NULL,
  `experiment_id` VARCHAR(36) NOT NULL,
  `variant_id` VARCHAR(36) NOT NULL,
  `metrics` JSON NOT NULL,
  `revenue_lift_pct` DECIMAL(10,4),
  `is_winner` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `exp_res_exp_idx` (`experiment_id`),
  KEY `exp_res_var_idx` (`variant_id`)
);
