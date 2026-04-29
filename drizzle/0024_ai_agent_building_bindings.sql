-- AI Agent Building Bindings: link agents to world buildings via API key
CREATE TABLE IF NOT EXISTS `ai_agent_building_bindings` (
  `id` varchar(36) NOT NULL,
  `agentId` varchar(36),
  `worldId` varchar(64) NOT NULL,
  `buildingId` varchar(64) NOT NULL,
  `apiKey` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `ai_agent_building_bindings_api_key_uidx` (`apiKey`),
  KEY `ai_agent_building_bindings_agent_idx` (`agentId`),
  KEY `ai_agent_building_bindings_world_building_idx` (`worldId`,`buildingId`),
  KEY `ai_agent_building_bindings_user_idx` (`userId`)
);
