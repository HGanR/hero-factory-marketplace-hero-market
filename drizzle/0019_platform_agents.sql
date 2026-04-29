-- Platform Agents: Agent Network catalog
CREATE TABLE IF NOT EXISTS `platform_agents` (
  `id` varchar(36) NOT NULL,
  `slug` varchar(80) NOT NULL,
  `name` varchar(120) NOT NULL,
  `description` text,
  `capabilities` json,
  `priceToken` int DEFAULT 0,
  `priceUSD` int DEFAULT 0,
  `creatorId` int,
  `status` enum('draft','published','archived') NOT NULL DEFAULT 'published',
  `metadataJson` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `platform_agents_slug_uidx` (`slug`),
  KEY `platform_agents_status_idx` (`status`),
  KEY `platform_agents_creator_idx` (`creatorId`)
);

-- Seed default agent
INSERT IGNORE INTO `platform_agents` (`id`, `slug`, `name`, `description`, `capabilities`, `priceToken`, `priceUSD`, `status`)
VALUES ('00000000-0000-0000-0000-000000000001', 'default', 'Default Agent', 'Basic conversational agent', '["chat","voice"]', 0, 0, 'published');
