-- SKIPPER controlled learning: events, summaries, suggestions, versioned overlays (admin-gated; no auto-apply).
-- TiDB: each statement is its own chunk (see drizzle.config.ts). Do not put the breakpoint marker text inside comments.

CREATE TABLE IF NOT EXISTS `skipper_learning_events` (
  `id` VARCHAR(36) NOT NULL,
  `adminUserId` INT NOT NULL,
  `eventType` VARCHAR(64) NOT NULL,
  `source` VARCHAR(32) NOT NULL DEFAULT 'chat',
  `payloadJson` LONGTEXT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `skipper_learn_events_admin_created` (`adminUserId`, `createdAt`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `skipper_learning_summaries` (
  `id` VARCHAR(36) NOT NULL,
  `adminUserId` INT NOT NULL,
  `windowStart` TIMESTAMP NOT NULL,
  `windowEnd` TIMESTAMP NOT NULL,
  `compressedJson` LONGTEXT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `skipper_learn_sum_admin_created` (`adminUserId`, `createdAt`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `skipper_prompt_improvement_suggestions` (
  `id` VARCHAR(36) NOT NULL,
  `adminUserId` INT NOT NULL,
  `summaryId` VARCHAR(36) NOT NULL,
  `title` VARCHAR(500) NOT NULL,
  `rationale` TEXT NOT NULL,
  `proposedOverlayContent` LONGTEXT NOT NULL,
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolvedAt` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `skipper_prompt_sug_admin_status` (`adminUserId`, `status`),
  KEY `skipper_prompt_sug_summary` (`summaryId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `skipper_capability_suggestions` (
  `id` VARCHAR(36) NOT NULL,
  `adminUserId` INT NOT NULL,
  `summaryId` VARCHAR(36) NOT NULL,
  `title` VARCHAR(500) NOT NULL,
  `description` TEXT NOT NULL,
  `suggestedFlagKey` VARCHAR(120) NULL,
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolvedAt` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `skipper_cap_sug_admin_status` (`adminUserId`, `status`),
  KEY `skipper_cap_sug_summary` (`summaryId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `skipper_prompt_overlays` (
  `id` VARCHAR(36) NOT NULL,
  `adminUserId` INT NOT NULL,
  `title` VARCHAR(500) NOT NULL,
  `content` LONGTEXT NOT NULL,
  `status` ENUM('pending', 'approved', 'rejected', 'active', 'archived') NOT NULL DEFAULT 'pending',
  `sourceSummaryId` VARCHAR(36) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approvedAt` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `skipper_overlay_admin_status` (`adminUserId`, `status`)
);
--> statement-breakpoint
ALTER TABLE `executive_agent_routines`
MODIFY COLUMN `routineType` ENUM(
  'daily_briefing',
  'stale_client_scan',
  'pending_account_scan',
  'bentley_readiness_scan',
  'approval_digest',
  'skipper_learning_digest'
) NOT NULL;
