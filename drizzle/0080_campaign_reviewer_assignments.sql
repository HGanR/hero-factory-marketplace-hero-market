CREATE TABLE `campaign_reviewer_assignments` (
	`id` varchar(36) NOT NULL,
	`campaign_id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`role` varchar(24) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_reviewer_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `camprevassign_campaign_user_uidx` ON `campaign_reviewer_assignments` (`campaign_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `camprevassign_campaign_idx` ON `campaign_reviewer_assignments` (`campaign_id`);
