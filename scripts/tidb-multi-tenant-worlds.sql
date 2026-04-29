-- Multi-tenant worlds tables for TiDB Cloud
-- Run this in TiDB Cloud SQL Editor to fix "Create World" 500 error
-- Uses IF NOT EXISTS so safe to run multiple times

USE `hero-market`;

-- Core tables for Create World flow
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

-- IMPORTANT: After creating worlds, run scripts/tidb-add-worlds-nft-columns.sql
-- (Drizzle schema expects ownerWallet, nftContractAddress, nftTokenId, saleStatus)

-- Supporting tables (IF NOT EXISTS = safe)
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

CREATE TABLE IF NOT EXISTS `platform_global_zone_versions` (
  `id` varchar(36) NOT NULL,
  `zoneId` varchar(36) NOT NULL,
  `versionNumber` int NOT NULL,
  `versionType` enum('draft','published') NOT NULL,
  `placementsJson` json NOT NULL,
  `npcsJson` json,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `platform_global_zone_versions_zone_idx` (`zoneId`),
  KEY `platform_global_zone_versions_zone_type_idx` (`zoneId`,`versionType`)
);

CREATE TABLE IF NOT EXISTS `world_chunk_placements` (
  `id` varchar(36) NOT NULL,
  `worldVersionId` varchar(36) NOT NULL,
  `chunkKey` varchar(20) NOT NULL,
  `placementsJson` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `world_chunk_placements_version_idx` (`worldVersionId`),
  KEY `world_chunk_placements_chunk_idx` (`worldVersionId`,`chunkKey`)
);

CREATE TABLE IF NOT EXISTS `world_reserved_zones` (
  `id` varchar(36) NOT NULL,
  `worldId` varchar(36),
  `zoneType` enum('platform','system','road','spawn') NOT NULL,
  `boundsJson` json NOT NULL,
  `sourceZoneId` varchar(36),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `world_reserved_zones_world_idx` (`worldId`),
  KEY `world_reserved_zones_type_idx` (`zoneType`)
);

CREATE TABLE IF NOT EXISTS `world_library_assets` (
  `id` varchar(36) NOT NULL,
  `slug` varchar(80) NOT NULL,
  `name` varchar(120) NOT NULL,
  `category` varchar(60) NOT NULL,
  `description` text,
  `status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
  `version` int NOT NULL DEFAULT 1,
  `modelUrl` varchar(512) NOT NULL,
  `previewImageUrl` varchar(512),
  `manifestUrl` varchar(512),
  `collisionType` enum('none','box','capsule','hull') NOT NULL DEFAULT 'box',
  `instancable` tinyint(1) NOT NULL DEFAULT 0,
  `lodProfile` varchar(40),
  `boundsJson` json,
  `tokenPrice` int NOT NULL DEFAULT 0,
  `supplyLimit` int,
  `isPlatformOnly` tinyint(1) NOT NULL DEFAULT 0,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `metadataJson` json,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `world_library_assets_slug_uidx` (`slug`),
  KEY `world_library_assets_category_idx` (`category`),
  KEY `world_library_assets_status_idx` (`status`),
  KEY `world_library_assets_active_idx` (`isActive`)
);

CREATE TABLE IF NOT EXISTS `user_world_assets` (
  `id` varchar(36) NOT NULL,
  `userId` int NOT NULL,
  `workspaceId` varchar(36),
  `assetId` varchar(36) NOT NULL,
  `licenseScope` enum('all_worlds_owned','one_world','quantity_based') NOT NULL DEFAULT 'all_worlds_owned',
  `remainingPlacements` int,
  `purchaseTx` varchar(128),
  `purchasedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `user_world_assets_user_idx` (`userId`),
  KEY `user_world_assets_asset_idx` (`assetId`)
);

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

CREATE TABLE IF NOT EXISTS `world_npcs` (
  `id` varchar(36) NOT NULL,
  `worldId` varchar(36) NOT NULL,
  `agentId` varchar(80) NOT NULL,
  `buildingId` varchar(36),
  `placementJson` json NOT NULL,
  `role` varchar(80),
  `voiceProfile` varchar(80),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `world_npcs_world_idx` (`worldId`)
);

CREATE TABLE IF NOT EXISTS `world_commerce_nodes` (
  `id` varchar(36) NOT NULL,
  `worldId` varchar(36) NOT NULL,
  `ownerId` int NOT NULL,
  `nodeType` enum('store','service','consultation','ad_space','product_display','event_space','course','npc_service') NOT NULL,
  `placementJson` json NOT NULL,
  `assetId` varchar(36),
  `title` varchar(120) NOT NULL,
  `description` text,
  `agentId` varchar(80),
  `entityId` varchar(36),
  `priceToken` int,
  `priceUSD` int,
  `revenueShare` int,
  `status` enum('draft','active','paused','archived') NOT NULL DEFAULT 'active',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `world_commerce_nodes_world_idx` (`worldId`),
  KEY `world_commerce_nodes_owner_idx` (`ownerId`),
  KEY `world_commerce_nodes_type_idx` (`nodeType`),
  KEY `world_commerce_nodes_status_idx` (`status`)
);

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

CREATE TABLE IF NOT EXISTS `platform_ad_slots` (
  `id` varchar(36) NOT NULL,
  `zoneId` varchar(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `placementJson` json NOT NULL,
  `adType` enum('billboard','video','kiosk','npc_sponsor','banner') NOT NULL,
  `priceToken` int,
  `currentAdvertiser` varchar(128),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `platform_ad_slots_zone_idx` (`zoneId`)
);

-- Verify: run after migration
-- SHOW TABLES LIKE 'world%';
