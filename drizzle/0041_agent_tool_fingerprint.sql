-- Idempotency / dedupe for agent tool calls. Restored after file was emptied; use --mark-file if TiDB already applied this migration.

CREATE TABLE IF NOT EXISTS `agent_tool_fingerprint` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `agentId` VARCHAR(36) NOT NULL,
  `actionKey` VARCHAR(64) NOT NULL,
  `inputHash` VARCHAR(64) NOT NULL,
  `resourceId` VARCHAR(255) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `agent_tool_fingerprint_uidx` (`agentId`, `actionKey`, `inputHash`),
  KEY `agent_tool_fingerprint_agent_idx` (`agentId`),
  KEY `agent_tool_fingerprint_created_idx` (`createdAt`)
);
