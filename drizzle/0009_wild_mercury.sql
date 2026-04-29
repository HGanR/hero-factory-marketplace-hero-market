CREATE TABLE `trust_collateral_pool_assets` (
	`id` varchar(36) NOT NULL,
	`poolId` varchar(36) NOT NULL,
	`assetId` varchar(36) NOT NULL,
	`allocatedValue` decimal(18,2),
	`lienPosition` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trust_collateral_pool_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_collateral_pools` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`coverageRatio` decimal(8,4),
	`haircutMethod` varchar(80),
	`valuationDate` date,
	`totalEstimatedValue` decimal(18,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_collateral_pools_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_instrument_events` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`instrumentId` varchar(36),
	`eventType` varchar(100) NOT NULL,
	`metadata` json,
	`actorRole` varchar(80),
	`actorId` varchar(36),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trust_instrument_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_instruments` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`workspaceId` varchar(36),
	`instrumentKind` enum('CERTIFICATE','BOND','PROMISSORY_NOTE','SECURED_NOTE','PPM_SECURITY','OTHER') NOT NULL,
	`instrumentSubtype` varchar(80),
	`instrumentLifecycleStatus` enum('DRAFT','AUTHORITY_REVIEW','COLLATERALIZED','GOVERNANCE_APPROVED','READY_TO_ISSUE','ISSUED','SIGNED','PACKAGED','DEPOSIT_INITIATED','DEPOSIT_COMPLETED','VOIDED','DEFAULTED','REDEEMED','MATURED') NOT NULL DEFAULT 'DRAFT',
	`serialNumber` varchar(80),
	`issuerName` varchar(255),
	`governingLaw` varchar(100),
	`faceValue` decimal(18,6),
	`currency` varchar(10) DEFAULT 'USD',
	`issueDate` date,
	`maturityDate` date,
	`ppmDocumentId` varchar(36),
	`governingResolutionId` varchar(36),
	`collateralPoolId` varchar(36),
	`debtInstrumentId` varchar(36),
	`certificateRefId` varchar(36),
	`createdBy` varchar(36),
	`signedAt` timestamp,
	`signedBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_instruments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_trust_collateral_pool_assets_poolId` ON `trust_collateral_pool_assets` (`poolId`);--> statement-breakpoint
CREATE INDEX `idx_trust_collateral_pool_assets_assetId` ON `trust_collateral_pool_assets` (`assetId`);--> statement-breakpoint
CREATE INDEX `idx_trust_collateral_pools_trustId` ON `trust_collateral_pools` (`trustId`);--> statement-breakpoint
CREATE INDEX `idx_trust_instrument_events_trustId` ON `trust_instrument_events` (`trustId`);--> statement-breakpoint
CREATE INDEX `idx_trust_instrument_events_instrumentId` ON `trust_instrument_events` (`instrumentId`);--> statement-breakpoint
CREATE INDEX `idx_trust_instrument_events_eventType` ON `trust_instrument_events` (`eventType`);--> statement-breakpoint
CREATE INDEX `idx_trust_instruments_trustId` ON `trust_instruments` (`trustId`);--> statement-breakpoint
CREATE INDEX `idx_trust_instruments_status` ON `trust_instruments` (`instrumentLifecycleStatus`);--> statement-breakpoint
CREATE INDEX `idx_trust_instruments_kind` ON `trust_instruments` (`instrumentKind`);--> statement-breakpoint
CREATE INDEX `idx_trust_instruments_serialNumber` ON `trust_instruments` (`serialNumber`);