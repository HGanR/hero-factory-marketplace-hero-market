CREATE TABLE `campaign_reviewer_assignment_audit_events` (
	`id` varchar(36) NOT NULL,
	`campaign_id` varchar(36) NOT NULL,
	`action` varchar(32) NOT NULL,
	`target_user_id` varchar(64) NOT NULL,
	`actor_user_id` varchar(64) NOT NULL,
	`previous_role` varchar(24),
	`next_role` varchar(24),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_reviewer_assignment_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `camprevaudit_campaign_created` ON `campaign_reviewer_assignment_audit_events` (`campaign_id`,`created_at`);
