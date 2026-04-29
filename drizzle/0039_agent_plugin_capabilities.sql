-- Per-agent plugin registry + OAuth rows (e.g. google_calendar). Restored after file was emptied; use --mark-file if TiDB already applied this migration.

CREATE TABLE IF NOT EXISTS `agent_plugin_installations` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `agentId` VARCHAR(36) NOT NULL,
  `pluginKey` VARCHAR(64) NOT NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `agent_plugin_installations_agent_plugin_uidx` (`agentId`, `pluginKey`),
  KEY `agent_plugin_installations_agent_idx` (`agentId`)
);

CREATE TABLE IF NOT EXISTS `agent_plugin_credentials` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `agentId` VARCHAR(36) NOT NULL,
  `provider` VARCHAR(32) NOT NULL,
  `refreshTokenEnc` TEXT,
  `accessTokenEnc` TEXT,
  `expiresAt` TIMESTAMP NULL,
  `scopesJson` TEXT,
  `lastError` VARCHAR(512),
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `agent_plugin_credentials_agent_provider_uidx` (`agentId`, `provider`),
  KEY `agent_plugin_credentials_agent_idx` (`agentId`)
);
