-- Accounting ↔ Trust Records Bridge — economic ledger for instrument lifecycle

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
CREATE INDEX `idx_accounting_event_inbox_status` ON `accounting_event_inbox` (`processingStatus`);
--> statement-breakpoint
CREATE INDEX `idx_accounting_event_inbox_source` ON `accounting_event_inbox` (`sourceSystem`);
--> statement-breakpoint
CREATE INDEX `idx_accounting_event_inbox_createdAt` ON `accounting_event_inbox` (`createdAt`);
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
CREATE INDEX `idx_accounting_financing_trustId` ON `accounting_financing_profiles` (`trustId`);
--> statement-breakpoint
CREATE INDEX `idx_accounting_financing_instrumentId` ON `accounting_financing_profiles` (`instrumentId`);
--> statement-breakpoint
CREATE INDEX `idx_accounting_financing_status` ON `accounting_financing_profiles` (`status`);
--> statement-breakpoint
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
CREATE INDEX `idx_accounting_encumbrances_trustId` ON `accounting_asset_encumbrances` (`trustId`);
--> statement-breakpoint
CREATE INDEX `idx_accounting_encumbrances_assetId` ON `accounting_asset_encumbrances` (`assetId`);
--> statement-breakpoint
CREATE INDEX `idx_accounting_encumbrances_instrumentId` ON `accounting_asset_encumbrances` (`instrumentId`);
