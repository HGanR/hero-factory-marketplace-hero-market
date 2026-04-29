-- Bentley experiment-driven content optimization
CREATE TABLE IF NOT EXISTS `bentley_content_experiments` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL DEFAULT '',
  `client_id` varchar(36) NOT NULL DEFAULT '',
  `trust_id` varchar(36) NOT NULL DEFAULT '',
  `market_sweep_snapshot_id` varchar(36),
  `next_action_type` varchar(64) NOT NULL DEFAULT '',
  `content_generation_mode` varchar(64) NOT NULL DEFAULT '',
  `experiment_theme` varchar(300) NOT NULL DEFAULT '',
  `status` varchar(24) NOT NULL DEFAULT 'draft',
  `hypothesis` text,
  `primary_metric` varchar(120) NOT NULL DEFAULT 'engagement_rate',
  `started_at` timestamp NULL,
  `completed_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bce_user_status_created` (`user_id`, `status`, `created_at`),
  KEY `bce_snapshot` (`market_sweep_snapshot_id`)
);

CREATE TABLE IF NOT EXISTS `bentley_content_experiment_variants` (
  `id` varchar(36) NOT NULL,
  `experiment_id` varchar(36) NOT NULL,
  `variant_key` varchar(8) NOT NULL,
  `hook_type` varchar(64) NOT NULL DEFAULT '',
  `angle` varchar(500) NOT NULL DEFAULT '',
  `cta_type` varchar(64) NOT NULL DEFAULT '',
  `platform` varchar(64) NOT NULL DEFAULT '',
  `content_type` varchar(64) NOT NULL DEFAULT '',
  `generation_payload_json` json,
  `status` varchar(24) NOT NULL DEFAULT 'draft',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bcev_experiment` (`experiment_id`),
  KEY `bcev_experiment_key` (`experiment_id`, `variant_key`)
);

CREATE TABLE IF NOT EXISTS `bentley_content_experiment_results` (
  `id` varchar(36) NOT NULL,
  `experiment_variant_id` varchar(36) NOT NULL,
  `impressions` int,
  `views` int,
  `clicks` int,
  `comments` int,
  `saves` int,
  `shares` int,
  `leads` int,
  `conversions` int,
  `negative_sentiment_ratio` decimal(8,4),
  `qualitative_notes` text,
  `measured_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bcer_variant_measured` (`experiment_variant_id`, `measured_at`),
  KEY `bcer_variant` (`experiment_variant_id`)
);
