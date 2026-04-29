-- Developer Platform: API Keys, Webhooks, Workflow Automations

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
CREATE INDEX `idx_developer_api_keys_userId` ON `developer_api_keys` (`userId`);
--> statement-breakpoint
CREATE INDEX `idx_developer_api_keys_keyHash` ON `developer_api_keys` (`keyHash`);
--> statement-breakpoint
CREATE TABLE `developer_webhooks` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`url` varchar(512) NOT NULL,
	`events` text NOT NULL,
	`secret` varchar(64),
	`isActive` boolean NOT NULL DEFAULT true,
	`lastTriggeredAt` timestamp,
	`lastStatus` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `developer_webhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_developer_webhooks_userId` ON `developer_webhooks` (`userId`);
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
CREATE INDEX `idx_workflow_automations_userId` ON `workflow_automations` (`userId`);
--> statement-breakpoint
CREATE INDEX `idx_workflow_automations_trigger` ON `workflow_automations` (`triggerEvent`);
