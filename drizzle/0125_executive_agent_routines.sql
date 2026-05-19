-- Scheduled executive routines (cron + admin run-now). No direct CRM/client mutation from runner.

CREATE TABLE IF NOT EXISTS `executive_agent_routines` (
  `id` VARCHAR(36) NOT NULL,
  `adminUserId` INT NOT NULL,
  `routineType` ENUM(
    'daily_briefing',
    'stale_client_scan',
    'pending_account_scan',
    'bentley_readiness_scan',
    'approval_digest'
  ) NOT NULL,
  `cadence` ENUM('daily', 'hourly', 'weekly') NOT NULL DEFAULT 'daily',
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `configJson` LONGTEXT NOT NULL,
  `lastRunAt` TIMESTAMP NULL,
  `nextRunAt` TIMESTAMP NOT NULL,
  `lastOutputJson` LONGTEXT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `exec_routines_admin_type` (`adminUserId`, `routineType`),
  KEY `exec_routines_due_idx` (`enabled`, `nextRunAt`)
);
