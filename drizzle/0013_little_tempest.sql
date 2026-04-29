CREATE TABLE `accounting_asset_encumbrances` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`assetId` varchar(36) NOT NULL,
	`instrumentId` varchar(36),
	`pledgedValue` decimal(18,2),
	`lienPosition` int,
	`coverageRatio` decimal(8,4),
	`effectiveDate` date,
	`releaseDate` date,
	`status` varchar(50) DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounting_asset_encumbrances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `accounting_event_inbox` (
	`id` varchar(36) NOT NULL,
	`sourceSystem` varchar(80) NOT NULL DEFAULT 'trust_records',
	`sourceEventType` varchar(100) NOT NULL,
	`sourceEventId` varchar(36),
	`payload` json,
	`processingStatus` enum('pending','processing','processed','failed') NOT NULL DEFAULT 'pending',
	`processedAt` timestamp,
	`processedByUserId` int,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accounting_event_inbox_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `accounting_financing_profiles` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`instrumentId` varchar(36),
	`principalAmount` decimal(18,6),
	`outstandingPrincipal` decimal(18,6),
	`interestRate` decimal(8,4),
	`accruedInterest` decimal(18,6),
	`nextPaymentDate` date,
	`maturityDate` date,
	`status` varchar(50) DEFAULT 'active',
	`currency` varchar(10) DEFAULT 'USD',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounting_financing_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `developer_api_keys` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`keyPrefix` varchar(12) NOT NULL,
	`keyHash` varchar(64) NOT NULL,
	`scopes` text,
	`lastUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `developer_api_keys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `developer_webhooks` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`url` varchar(512) NOT NULL,
	`events` text NOT NULL,
	`secret` varchar(128),
	`isActive` boolean NOT NULL DEFAULT true,
	`lastTriggeredAt` timestamp,
	`lastStatus` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `developer_webhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_activity` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`sourceModule` varchar(80) NOT NULL,
	`payload` json,
	`trustId` varchar(36),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `platform_activity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_automations` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`triggerEvent` varchar(100) NOT NULL,
	`triggerFilter` json,
	`actions` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastRunAt` timestamp,
	`runCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_automations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_ad_slots` (
	`id` varchar(36) NOT NULL,
	`zoneId` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`placementJson` json NOT NULL,
	`adType` enum('billboard','video','kiosk','npc_sponsor','banner') NOT NULL,
	`priceToken` int,
	`currentAdvertiser` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_ad_slots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_global_zone_versions` (
	`id` varchar(36) NOT NULL,
	`zoneId` varchar(36) NOT NULL,
	`versionNumber` int NOT NULL,
	`versionType` enum('draft','published') NOT NULL,
	`placementsJson` json NOT NULL,
	`npcsJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_global_zone_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_global_zones` (
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
	CONSTRAINT `platform_global_zones_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_global_zones_slug_uidx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `user_world_assets` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`workspaceId` varchar(36),
	`assetId` varchar(36) NOT NULL,
	`licenseScope` enum('all_worlds_owned','one_world','quantity_based') NOT NULL DEFAULT 'all_worlds_owned',
	`remainingPlacements` int,
	`purchaseTx` varchar(128),
	`purchasedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_world_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `world_chunk_placements` (
	`id` varchar(36) NOT NULL,
	`worldVersionId` varchar(36) NOT NULL,
	`chunkKey` varchar(20) NOT NULL,
	`placementsJson` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `world_chunk_placements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `world_library_assets` (
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
	CONSTRAINT `world_library_assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `world_library_assets_slug_uidx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `world_npcs` (
	`id` varchar(36) NOT NULL,
	`worldId` varchar(36) NOT NULL,
	`agentId` varchar(80) NOT NULL,
	`buildingId` varchar(36),
	`placementJson` json NOT NULL,
	`role` varchar(80),
	`voiceProfile` varchar(80),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `world_npcs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `world_reserved_zones` (
	`id` varchar(36) NOT NULL,
	`worldId` varchar(36),
	`zoneType` enum('platform','system','road','spawn') NOT NULL,
	`boundsJson` json NOT NULL,
	`sourceZoneId` varchar(36),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `world_reserved_zones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `world_versions` (
	`id` varchar(36) NOT NULL,
	`worldId` varchar(36) NOT NULL,
	`versionType` enum('draft','published') NOT NULL,
	`versionNumber` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `world_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `worlds` (
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
	CONSTRAINT `worlds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_accounting_encumbrances_trustId` ON `accounting_asset_encumbrances` (`trustId`);--> statement-breakpoint
CREATE INDEX `idx_accounting_encumbrances_assetId` ON `accounting_asset_encumbrances` (`assetId`);--> statement-breakpoint
CREATE INDEX `idx_accounting_encumbrances_instrumentId` ON `accounting_asset_encumbrances` (`instrumentId`);--> statement-breakpoint
CREATE INDEX `idx_accounting_event_inbox_status` ON `accounting_event_inbox` (`processingStatus`);--> statement-breakpoint
CREATE INDEX `idx_accounting_event_inbox_source` ON `accounting_event_inbox` (`sourceSystem`);--> statement-breakpoint
CREATE INDEX `idx_accounting_event_inbox_createdAt` ON `accounting_event_inbox` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_accounting_financing_trustId` ON `accounting_financing_profiles` (`trustId`);--> statement-breakpoint
CREATE INDEX `idx_accounting_financing_instrumentId` ON `accounting_financing_profiles` (`instrumentId`);--> statement-breakpoint
CREATE INDEX `idx_accounting_financing_status` ON `accounting_financing_profiles` (`status`);--> statement-breakpoint
CREATE INDEX `idx_developer_api_keys_userId` ON `developer_api_keys` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_developer_api_keys_keyHash` ON `developer_api_keys` (`keyHash`);--> statement-breakpoint
CREATE INDEX `idx_developer_webhooks_userId` ON `developer_webhooks` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_platform_activity_userId` ON `platform_activity` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_platform_activity_eventType` ON `platform_activity` (`eventType`);--> statement-breakpoint
CREATE INDEX `idx_platform_activity_createdAt` ON `platform_activity` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_workflow_automations_userId` ON `workflow_automations` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_workflow_automations_trigger` ON `workflow_automations` (`triggerEvent`);--> statement-breakpoint
CREATE INDEX `platform_ad_slots_zone_idx` ON `platform_ad_slots` (`zoneId`);--> statement-breakpoint
CREATE INDEX `platform_global_zone_versions_zone_idx` ON `platform_global_zone_versions` (`zoneId`);--> statement-breakpoint
CREATE INDEX `platform_global_zone_versions_zone_type_idx` ON `platform_global_zone_versions` (`zoneId`,`versionType`);--> statement-breakpoint
CREATE INDEX `platform_global_zones_active_idx` ON `platform_global_zones` (`isActive`);--> statement-breakpoint
CREATE INDEX `user_world_assets_user_idx` ON `user_world_assets` (`userId`);--> statement-breakpoint
CREATE INDEX `user_world_assets_asset_idx` ON `user_world_assets` (`assetId`);--> statement-breakpoint
CREATE INDEX `world_chunk_placements_version_idx` ON `world_chunk_placements` (`worldVersionId`);--> statement-breakpoint
CREATE INDEX `world_chunk_placements_chunk_idx` ON `world_chunk_placements` (`worldVersionId`,`chunkKey`);--> statement-breakpoint
CREATE INDEX `world_library_assets_category_idx` ON `world_library_assets` (`category`);--> statement-breakpoint
CREATE INDEX `world_library_assets_status_idx` ON `world_library_assets` (`status`);--> statement-breakpoint
CREATE INDEX `world_library_assets_active_idx` ON `world_library_assets` (`isActive`);--> statement-breakpoint
CREATE INDEX `world_npcs_world_idx` ON `world_npcs` (`worldId`);--> statement-breakpoint
CREATE INDEX `world_reserved_zones_world_idx` ON `world_reserved_zones` (`worldId`);--> statement-breakpoint
CREATE INDEX `world_reserved_zones_type_idx` ON `world_reserved_zones` (`zoneType`);--> statement-breakpoint
CREATE INDEX `world_versions_world_idx` ON `world_versions` (`worldId`);--> statement-breakpoint
CREATE INDEX `world_versions_world_type_idx` ON `world_versions` (`worldId`,`versionType`);--> statement-breakpoint
CREATE INDEX `worlds_owner_idx` ON `worlds` (`ownerId`);--> statement-breakpoint
CREATE INDEX `worlds_visibility_idx` ON `worlds` (`visibility`);--> statement-breakpoint
CREATE INDEX `worlds_status_idx` ON `worlds` (`status`);