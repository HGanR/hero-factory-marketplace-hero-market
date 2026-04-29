-- TiDB Full Migration (clean, safe to re-run)
-- Use New SQL File, paste this, then Run

USE `hero-market`;

-- Troo worlds
CREATE TABLE IF NOT EXISTS `troo_worlds` (
  `id` varchar(64) NOT NULL,
  `name` varchar(180) NOT NULL,
  `slug` varchar(200) NOT NULL,
  `isDefault` tinyint(1) NOT NULL DEFAULT 0,
  `isPublished` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `troo_world_placements` (
  `id` int AUTO_INCREMENT NOT NULL,
  `worldId` varchar(64) NOT NULL,
  `elementKey` varchar(80) NOT NULL,
  `glbUrl` text NOT NULL,
  `posX` decimal(12,4) NOT NULL,
  `posY` decimal(12,4) NOT NULL,
  `posZ` decimal(12,4) NOT NULL,
  `scale` decimal(12,4) NOT NULL DEFAULT 1,
  `rotY` decimal(12,4) NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `troo_placements_world_idx` (`worldId`),
  INDEX `troo_placements_world_element_idx` (`worldId`, `elementKey`)
);

-- Revenue OS
CREATE TABLE IF NOT EXISTS `revenue_os_funnels` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `profile_id` varchar(36),
  `client_id` varchar(36) NOT NULL DEFAULT '',
  `trust_id` varchar(36) NOT NULL DEFAULT '',
  `name` varchar(200) NOT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'DRAFT',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `revenue_os_funnel_pages` (
  `id` varchar(36) NOT NULL,
  `funnel_id` varchar(36) NOT NULL,
  `title` varchar(200) NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `sections` json,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `revenue_os_message_sequences` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `profile_id` varchar(36),
  `client_id` varchar(36) NOT NULL DEFAULT '',
  `trust_id` varchar(36) NOT NULL DEFAULT '',
  `channel` varchar(24) NOT NULL,
  `name` varchar(200) NOT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'DRAFT',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `revenue_os_sequence_steps` (
  `id` varchar(36) NOT NULL,
  `sequence_id` varchar(36) NOT NULL,
  `day_offset` int NOT NULL,
  `subject` varchar(500),
  `body` text NOT NULL,
  `trigger` varchar(120),
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`)
);

-- Market
CREATE TABLE IF NOT EXISTS `market_sources` (
  `id` varchar(36) NOT NULL,
  `name` varchar(200) NOT NULL,
  `url` varchar(512),
  `industry` varchar(120),
  `source_type` varchar(64),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `market_scans` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `industry` varchar(120) NOT NULL,
  `geo` varchar(120),
  `offer_type` varchar(120),
  `payload` json,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `capital_plans` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `client_id` varchar(36) NOT NULL DEFAULT '',
  `trust_id` varchar(36) NOT NULL DEFAULT '',
  `ad_spend` decimal(18,2) NOT NULL,
  `channel_mix` json,
  `cac` decimal(18,2) NOT NULL,
  `ltv` decimal(18,2) NOT NULL,
  `margins` decimal(5,4),
  `payload` json,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `channel_spend_snapshots` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `client_id` varchar(36) NOT NULL DEFAULT '',
  `month` varchar(7) NOT NULL,
  `channel` varchar(64) NOT NULL,
  `spend` decimal(18,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`)
);

-- Commerce & Platform Agents
CREATE TABLE IF NOT EXISTS `commerce_transactions` (
  `id` varchar(36) NOT NULL,
  `worldId` varchar(36) NOT NULL,
  `nodeId` varchar(36) NOT NULL,
  `payerId` int NOT NULL,
  `payeeId` int NOT NULL,
  `amountToken` int,
  `amountUSD` int,
  `platformFeeToken` int,
  `platformFeeUSD` int,
  `ownerAmountToken` int,
  `ownerAmountUSD` int,
  `currency` enum('token','usd','both') NOT NULL DEFAULT 'token',
  `status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'completed',
  `txRef` varchar(128),
  `metadataJson` json,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `commerce_transactions_world_idx` (`worldId`),
  KEY `commerce_transactions_node_idx` (`nodeId`),
  KEY `commerce_transactions_payer_idx` (`payerId`),
  KEY `commerce_transactions_payee_idx` (`payeeId`),
  KEY `commerce_transactions_status_idx` (`status`)
);

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
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `platform_agents_slug_uidx` (`slug`),
  KEY `platform_agents_status_idx` (`status`),
  KEY `platform_agents_creator_idx` (`creatorId`)
);

INSERT IGNORE INTO `platform_agents` (`id`, `slug`, `name`, `description`, `capabilities`, `priceToken`, `priceUSD`, `status`)
VALUES ('00000000-0000-0000-0000-000000000001', 'default', 'Default Agent', 'Basic conversational agent', '["chat","voice"]', 0, 0, 'published');

-- Troo identities
CREATE TABLE IF NOT EXISTS `troo_identities` (
  `id` varchar(36) NOT NULL,
  `trooId` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `troo_identities_troo_id_uidx` (`trooId`),
  UNIQUE KEY `troo_identities_user_uidx` (`userId`)
);

CREATE TABLE IF NOT EXISTS `troo_wallet_links` (
  `id` varchar(36) NOT NULL,
  `identityId` varchar(36) NOT NULL,
  `chain` varchar(32) NOT NULL,
  `address` varchar(128) NOT NULL,
  `verifiedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `troo_wallet_links_identity_idx` (`identityId`),
  UNIQUE KEY `troo_wallet_links_chain_address_uidx` (`chain`, `address`)
);

-- World Links
CREATE TABLE IF NOT EXISTS `world_links` (
  `id` varchar(36) NOT NULL,
  `fromWorldId` varchar(36) NOT NULL,
  `toWorldId` varchar(36) NOT NULL,
  `label` varchar(120),
  `placementJson` json,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `world_links_from_idx` (`fromWorldId`),
  KEY `world_links_to_idx` (`toWorldId`)
);

-- Platform Global Zones
CREATE TABLE IF NOT EXISTS `platform_global_zones` (
  `id` varchar(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `slug` varchar(80) NOT NULL,
  `boundsJson` json NOT NULL,
  `placementsJson` json NOT NULL,
  `npcsJson` json,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `priority` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `platform_global_zones_slug_uidx` (`slug`),
  KEY `platform_global_zones_active_idx` (`isActive`)
);

-- AI Agent Building Bindings
CREATE TABLE IF NOT EXISTS `ai_agent_building_bindings` (
  `id` varchar(36) NOT NULL,
  `agentId` varchar(36),
  `worldId` varchar(64) NOT NULL,
  `buildingId` varchar(64) NOT NULL,
  `apiKey` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `ai_agent_building_bindings_api_key_uidx` (`apiKey`),
  KEY `ai_agent_building_bindings_agent_idx` (`agentId`),
  KEY `ai_agent_building_bindings_world_building_idx` (`worldId`,`buildingId`),
  KEY `ai_agent_building_bindings_user_idx` (`userId`)
);

-- Hero Market Worlds
CREATE TABLE IF NOT EXISTS `worlds` (
  `id` varchar(36) NOT NULL,
  `ownerId` int NOT NULL,
  `workspaceId` varchar(36),
  `name` varchar(120) NOT NULL,
  `description` text,
  `visibility` enum('private','public','unlisted','token_gated') NOT NULL DEFAULT 'private',
  `terrainSeed` int NOT NULL DEFAULT 42,
  `biomeType` varchar(40) NOT NULL DEFAULT 'green-terrain',
  `status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `worlds_owner_idx` (`ownerId`),
  KEY `worlds_visibility_idx` (`visibility`),
  KEY `worlds_status_idx` (`status`)
);

CREATE TABLE IF NOT EXISTS `world_versions` (
  `id` varchar(36) NOT NULL,
  `worldId` varchar(36) NOT NULL,
  `versionType` enum('draft','published') NOT NULL,
  `versionNumber` int NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `world_versions_world_idx` (`worldId`),
  KEY `world_versions_world_type_idx` (`worldId`,`versionType`)
);

-- NFT columns for worlds (safe to re-run with IF NOT EXISTS)
ALTER TABLE `worlds` ADD COLUMN IF NOT EXISTS `ownerWallet` varchar(42) NULL;
ALTER TABLE `worlds` ADD COLUMN IF NOT EXISTS `nftContractAddress` varchar(42) NULL;
ALTER TABLE `worlds` ADD COLUMN IF NOT EXISTS `nftTokenId` varchar(80) NULL;
ALTER TABLE `worlds` ADD COLUMN IF NOT EXISTS `saleStatus` enum('not_listed','listed','sold') NULL;
CREATE INDEX IF NOT EXISTS `worlds_owner_wallet_idx` ON `worlds` (`ownerWallet`);
