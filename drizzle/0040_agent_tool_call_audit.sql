-- Audit log for agent Google tool invocations (runtime + test). Production should use migrations; ensureAgentTables mirrors for dev fallback.

CREATE TABLE IF NOT EXISTS `agent_tool_call_audit` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `agentId` VARCHAR(36) NOT NULL,
  `userId` INT NOT NULL,
  `actionKey` VARCHAR(64) NOT NULL,
  `inputSummary` TEXT NOT NULL,
  `success` TINYINT(1) NOT NULL DEFAULT 0,
  `errorCode` VARCHAR(64) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `agent_tool_call_audit_agent_idx` (`agentId`),
  KEY `agent_tool_call_audit_user_idx` (`userId`),
  KEY `agent_tool_call_audit_created_idx` (`createdAt`)
);
