ALTER TABLE `campaign_reviewer_assignments` ADD COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
--> statement-breakpoint
UPDATE `campaign_reviewer_assignments` SET `updated_at` = `created_at`;
