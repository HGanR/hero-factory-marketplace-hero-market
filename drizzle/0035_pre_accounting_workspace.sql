-- Pre-accounting / tax prep workspace persistence

CREATE TABLE `accounting_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`workspaceId` varchar(64),
	`taxYear` int NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`accountingBasis` varchar(16) NOT NULL DEFAULT 'unknown',
	`hasPayroll` boolean NOT NULL DEFAULT false,
	`hasContractors` boolean NOT NULL DEFAULT false,
	`hasInventory` boolean NOT NULL DEFAULT false,
	`hasFixedAssets` boolean NOT NULL DEFAULT false,
	`priorYearReturnAvailable` boolean NOT NULL DEFAULT false,
	`reviewStatus` varchar(40) NOT NULL DEFAULT 'draft',
	`preparerNotes` text,
	`quarterStatesJson` text,
	`documentsTagsJson` text,
	`extendedFactsJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounting_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `accounting_profiles_user_year_uidx` UNIQUE(`userId`,`taxYear`)
);
--> statement-breakpoint
CREATE INDEX `accounting_profiles_user_idx` ON `accounting_profiles` (`userId`);
--> statement-breakpoint
CREATE TABLE `accounting_document_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountingProfileId` int NOT NULL,
	`documentName` varchar(512) NOT NULL,
	`documentTag` varchar(64) NOT NULL,
	`fileUrl` varchar(1024),
	`storageKey` varchar(512),
	`mimeType` varchar(128),
	`reportingPeriodLabel` varchar(64),
	`quarterLabel` varchar(8),
	`taxYear` int NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'uploaded',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounting_document_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `accounting_doc_records_profile_idx` ON `accounting_document_records` (`accountingProfileId`);
--> statement-breakpoint
CREATE TABLE `accounting_quarterly_workflows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountingProfileId` int NOT NULL,
	`quarterLabel` varchar(8) NOT NULL,
	`checklistJson` text,
	`notes` text,
	`status` varchar(40) NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounting_quarterly_workflows_id` PRIMARY KEY(`id`),
	CONSTRAINT `accounting_quarterly_profile_q_uidx` UNIQUE(`accountingProfileId`,`quarterLabel`)
);
--> statement-breakpoint
CREATE TABLE `accounting_readiness_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountingProfileId` int NOT NULL,
	`bookkeepingScore` int NOT NULL,
	`missingDocumentsJson` text,
	`unresolvedItemsCount` int NOT NULL DEFAULT 0,
	`quarterReadinessJson` text,
	`yearEndStatus` varchar(32) NOT NULL,
	`handoffPercent` int NOT NULL,
	`computedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accounting_readiness_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `accounting_readiness_profile_idx` ON `accounting_readiness_snapshots` (`accountingProfileId`);
--> statement-breakpoint
CREATE TABLE `tax_form_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountingProfileId` int NOT NULL,
	`formCode` varchar(64) NOT NULL,
	`displayName` varchar(512) NOT NULL,
	`rationale` text,
	`supportNeededJson` text,
	`status` varchar(40) NOT NULL DEFAULT 'partial',
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tax_form_candidates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `tax_form_candidates_profile_idx` ON `tax_form_candidates` (`accountingProfileId`);
--> statement-breakpoint
CREATE TABLE `tax_preparer_handoffs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountingProfileId` int NOT NULL,
	`packetName` varchar(255) NOT NULL,
	`summaryText` text,
	`packetStatus` varchar(40) NOT NULL DEFAULT 'draft',
	`exportedFileUrl` varchar(1024),
	`probableFormsJson` text,
	`missingItemsJson` text,
	`preparerNotes` text,
	`bundleStorageKey` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tax_preparer_handoffs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `tax_preparer_handoffs_profile_idx` ON `tax_preparer_handoffs` (`accountingProfileId`);
--> statement-breakpoint
CREATE TABLE `accounting_review_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountingProfileId` int NOT NULL,
	`relatedRecordType` varchar(64) NOT NULL,
	`relatedRecordId` int NOT NULL,
	`authorRole` varchar(32) NOT NULL,
	`note` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accounting_review_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `accounting_review_notes_profile_idx` ON `accounting_review_notes` (`accountingProfileId`);
--> statement-breakpoint
CREATE TABLE `accounting_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountingProfileId` int,
	`actorId` int,
	`actionType` varchar(100) NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` varchar(64) NOT NULL,
	`metadataJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accounting_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `accounting_audit_log_profile_idx` ON `accounting_audit_log` (`accountingProfileId`);
--> statement-breakpoint
CREATE INDEX `accounting_audit_log_actor_idx` ON `accounting_audit_log` (`actorId`);
