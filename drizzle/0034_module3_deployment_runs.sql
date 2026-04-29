-- Module 3: funnel deployment + sequence execution audit (idempotent).

CREATE TABLE IF NOT EXISTS `revenue_os_funnel_deployment_runs` (
  `id` VARCHAR(36) NOT NULL,
  `funnel_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `client_id` VARCHAR(36) NOT NULL DEFAULT '',
  `trust_id` VARCHAR(36) NOT NULL DEFAULT '',
  `provider` VARCHAR(32) NOT NULL DEFAULT 'artifact',
  `mode` VARCHAR(32) NOT NULL DEFAULT 'stored',
  `status` VARCHAR(24) NOT NULL,
  `result_summary` JSON,
  `error_message` TEXT,
  `started_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finished_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `revos_funnel_run_funnel_idx` (`funnel_id`),
  KEY `revos_funnel_run_user_client_idx` (`user_id`, `client_id`)
);

CREATE TABLE IF NOT EXISTS `revenue_os_sequence_execution_runs` (
  `id` VARCHAR(36) NOT NULL,
  `sequence_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `client_id` VARCHAR(36) NOT NULL DEFAULT '',
  `trust_id` VARCHAR(36) NOT NULL DEFAULT '',
  `provider` VARCHAR(32) NOT NULL DEFAULT 'none',
  `mode` VARCHAR(32) NOT NULL,
  `status` VARCHAR(24) NOT NULL,
  `result_summary` JSON,
  `error_message` TEXT,
  `started_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finished_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `revos_seq_run_seq_idx` (`sequence_id`),
  KEY `revos_seq_run_user_client_idx` (`user_id`, `client_id`)
);
