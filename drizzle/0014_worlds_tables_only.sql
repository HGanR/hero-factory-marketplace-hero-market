-- Add multi-tenant world tables only (schema.worlds.ts)
-- Safe to run: uses IF NOT EXISTS

CREATE TABLE IF NOT EXISTS `platform_global_zones` (
  `id` varchar(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `slug` varchar(80) NOT NULL,
  `boundsJson` json NOT NULL,
  `placementsJson` json NOT NULL,
  `npcsJson` json,
  `isActive` boolean NOT NULL DEFAULT true,
  `priority` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
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
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `platform_global_zone_versions_zone_idx` (`zoneId`),
  KEY `platform_global_zone_versions_zone_type_idx` (`zoneId`,`versionType`)
);

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
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
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
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `world_versions_world_idx` (`worldId`),
  KEY `world_versions_world_type_idx` (`worldId`,`versionType`)
);

CREATE TABLE IF NOT EXISTS `world_chunk_placements` (
  `id` varchar(36) NOT NULL,
  `worldVersionId` varchar(36) NOT NULL,
  `chunkKey` varchar(20) NOT NULL,
  `placementsJson` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
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
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
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
  `instancable` boolean NOT NULL DEFAULT false,
  `lodProfile` varchar(40),
  `boundsJson` json,
  `tokenPrice` int NOT NULL DEFAULT 0,
  `supplyLimit` int,
  `isPlatformOnly` boolean NOT NULL DEFAULT false,
  `isActive` boolean NOT NULL DEFAULT true,
  `metadataJson` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
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
  `purchasedAt` timestamp NOT NULL DEFAULT (now()),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY(`id`),
  KEY `user_world_assets_user_idx` (`userId`),
  KEY `user_world_assets_asset_idx` (`assetId`)
);

CREATE TABLE IF NOT EXISTS `world_npcs` (
  `id` varchar(36) NOT NULL,
  `worldId` varchar(36) NOT NULL,
  `agentId` varchar(80) NOT NULL,
  `buildingId` varchar(36),
  `placementJson` json NOT NULL,
  `role` varchar(80),
  `voiceProfile` varchar(80),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `world_npcs_world_idx` (`worldId`)
);

CREATE TABLE IF NOT EXISTS `platform_ad_slots` (
  `id` varchar(36) NOT NULL,
  `zoneId` varchar(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `placementJson` json NOT NULL,
  `adType` enum('billboard','video','kiosk','npc_sponsor','banner') NOT NULL,
  `priceToken` int,
  `currentAdvertiser` varchar(128),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `platform_ad_slots_zone_idx` (`zoneId`)
);
