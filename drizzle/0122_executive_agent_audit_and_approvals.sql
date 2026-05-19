-- Executive Administration Agent: audit trail + human approval queue

CREATE TABLE IF NOT EXISTS `executive_agent_audit_logs` (
  `id` VARCHAR(36) NOT NULL,
  `adminUserId` INT NOT NULL,
  `prompt` TEXT NULL,
  `toolName` VARCHAR(120) NOT NULL,
  `actionType` VARCHAR(64) NOT NULL,
  `targetType` VARCHAR(64) NULL,
  `targetId` VARCHAR(191) NULL,
  `inputJson` LONGTEXT NULL,
  `outputJson` LONGTEXT NULL,
  `approvalStatus` VARCHAR(32) NOT NULL DEFAULT 'not_required',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `executive_agent_audit_logs_admin_idx` (`adminUserId`),
  KEY `executive_agent_audit_logs_created_idx` (`createdAt`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `executive_agent_approvals` (
  `id` VARCHAR(36) NOT NULL,
  `adminUserId` INT NOT NULL,
  `proposedAction` VARCHAR(120) NOT NULL,
  `targetType` VARCHAR(64) NULL,
  `targetId` VARCHAR(191) NULL,
  `payloadJson` LONGTEXT NOT NULL,
  `status` ENUM('pending','approved','rejected','executed','failed') NOT NULL DEFAULT 'pending',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `executedAt` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `executive_agent_approvals_admin_idx` (`adminUserId`),
  KEY `executive_agent_approvals_status_idx` (`status`)
);
