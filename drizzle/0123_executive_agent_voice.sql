-- Executive voice command sessions (transcript + metadata only; no raw audio storage)

CREATE TABLE IF NOT EXISTS `executive_agent_voice_sessions` (
  `id` VARCHAR(36) NOT NULL,
  `adminUserId` INT NOT NULL,
  `provider` VARCHAR(32) NOT NULL,
  `status` ENUM('active','ended') NOT NULL DEFAULT 'active',
  `inputMode` VARCHAR(32) NOT NULL,
  `outputMode` VARCHAR(32) NOT NULL,
  `expiresAt` TIMESTAMP NOT NULL,
  `clientConfigJson` LONGTEXT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `endedAt` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `executive_voice_sessions_admin_idx` (`adminUserId`),
  KEY `executive_voice_sessions_status_idx` (`status`),
  KEY `executive_voice_sessions_expires_idx` (`expiresAt`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `executive_agent_voice_turns` (
  `id` VARCHAR(36) NOT NULL,
  `sessionId` VARCHAR(36) NOT NULL,
  `adminUserId` INT NOT NULL,
  `transcriptText` LONGTEXT NOT NULL,
  `responseText` LONGTEXT NOT NULL,
  `plannerMetaJson` LONGTEXT NULL,
  `proposedApprovalsCount` INT NOT NULL DEFAULT 0,
  `orchestratorSource` VARCHAR(24) NOT NULL DEFAULT 'voice',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `executive_voice_turns_session_idx` (`sessionId`),
  KEY `executive_voice_turns_admin_idx` (`adminUserId`),
  KEY `executive_voice_turns_created_idx` (`createdAt`)
);
