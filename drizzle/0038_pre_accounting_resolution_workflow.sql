-- Resolution workflow, document outcomes, form support gaps, quarter closeout, readiness override

ALTER TABLE `accounting_profiles`
ADD `handoffReadinessOverrideNote` text;
--> statement-breakpoint
ALTER TABLE `accounting_profiles`
ADD `handoffReadinessOverrideAt` timestamp;
--> statement-breakpoint

ALTER TABLE `accounting_document_records`
ADD `rejectionReason` text;
--> statement-breakpoint
ALTER TABLE `accounting_document_records`
ADD `supersedesDocumentId` int;
--> statement-breakpoint

ALTER TABLE `accounting_quarterly_workflows`
ADD `closeoutJson` text;
--> statement-breakpoint

ALTER TABLE `tax_form_candidates`
ADD `supportGapStatus` varchar(32) NOT NULL DEFAULT 'open';
--> statement-breakpoint
ALTER TABLE `tax_form_candidates`
ADD `supportGapNote` text;
--> statement-breakpoint

CREATE TABLE `accounting_review_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountingProfileId` int NOT NULL,
	`sourceType` varchar(64) NOT NULL,
	`sourceId` varchar(64),
	`title` varchar(512) NOT NULL,
	`description` text,
	`severity` varchar(16) NOT NULL DEFAULT 'warning',
	`status` varchar(32) NOT NULL DEFAULT 'open',
	`assignedRole` varchar(32) NOT NULL DEFAULT 'reviewer',
	`dueAt` timestamp,
	`resolutionNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`resolvedAt` timestamp,
	CONSTRAINT `accounting_review_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `accounting_review_items_profile_idx` ON `accounting_review_items` (`accountingProfileId`);
--> statement-breakpoint
CREATE INDEX `accounting_review_items_profile_status_idx` ON `accounting_review_items` (`accountingProfileId`,`status`);
