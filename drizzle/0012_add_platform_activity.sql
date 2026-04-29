-- Webhook secret column: support raw secret for HMAC (was 64 for hash)
ALTER TABLE `developer_webhooks` MODIFY COLUMN `secret` varchar(128) NULL;
--> statement-breakpoint
-- Platform Activity Stream

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
CREATE INDEX `idx_platform_activity_userId` ON `platform_activity` (`userId`);
--> statement-breakpoint
CREATE INDEX `idx_platform_activity_eventType` ON `platform_activity` (`eventType`);
--> statement-breakpoint
CREATE INDEX `idx_platform_activity_createdAt` ON `platform_activity` (`createdAt`);
