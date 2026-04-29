CREATE TABLE `trust_asset_events` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36),
	`assetId` varchar(36),
	`eventType` varchar(100) NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trust_asset_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_asset_instruments` (
	`id` varchar(36) NOT NULL,
	`assetId` varchar(36) NOT NULL,
	`instrumentType` varchar(100),
	`issuer` varchar(255),
	`faceValue` decimal(18,2),
	`issueDate` date,
	`transferability` varchar(100),
	`cusip` varchar(20),
	`transferAgent` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_asset_instruments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_brokerage_accounts` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`institution` varchar(255),
	`accountNumber` varchar(255),
	`accountType` varchar(50),
	`authorizedBroker` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_brokerage_accounts_id` PRIMARY KEY(`id`)
);
