-- Server-side chat turns for Google tool confirmation + multi-turn reliability (merged with client history).
CREATE TABLE IF NOT EXISTS `agent_conversation_sessions` (
  `sessionKey` VARCHAR(128) NOT NULL PRIMARY KEY,
  `agentId` VARCHAR(36) NOT NULL,
  `userId` INT NOT NULL,
  `turnsJson` TEXT NOT NULL,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `agent_conversation_sessions_agent_idx` (`agentId`),
  KEY `agent_conversation_sessions_user_idx` (`userId`)
);

-- Compact outcome + timing for audits (inputs stay redacted in inputSummary).
ALTER TABLE `agent_tool_call_audit` ADD COLUMN `successDescriptor` VARCHAR(255) NULL;
ALTER TABLE `agent_tool_call_audit` ADD COLUMN `latencyMs` INT NULL;
