CREATE TABLE `agent_architecture_maps` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`consultantId` varchar(36),
	`title` varchar(255) NOT NULL,
	`nodesJson` text NOT NULL,
	`edgesJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_architecture_maps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `troo_world_placements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`worldId` varchar(64) NOT NULL,
	`elementKey` varchar(80) NOT NULL,
	`glbUrl` text NOT NULL,
	`posX` decimal(12,4) NOT NULL,
	`posY` decimal(12,4) NOT NULL,
	`posZ` decimal(12,4) NOT NULL,
	`scale` decimal(12,4) NOT NULL DEFAULT '1',
	`rotY` decimal(12,4) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `troo_world_placements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `troo_worlds` (
	`id` varchar(64) NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`isDefault` boolean NOT NULL DEFAULT false,
	`isPublished` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `troo_worlds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `challenge_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`action` varchar(64) NOT NULL,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `challenge_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `challenge_credits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`challengeKey` varchar(64) NOT NULL,
	`creditType` varchar(48) NOT NULL,
	`amount` int NOT NULL,
	`appliedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `challenge_credits_id` PRIMARY KEY(`id`),
	CONSTRAINT `challenge_credits_submissionId_unique` UNIQUE(`submissionId`)
);
--> statement-breakpoint
CREATE TABLE `challenge_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`challengeKey` varchar(64) NOT NULL,
	`rulesVersion` varchar(16) NOT NULL,
	`rubricVersion` varchar(16) NOT NULL,
	`scoringVersion` varchar(16) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'draft',
	`answers` json,
	`totalScore` int,
	`phaseScores` json,
	`submissionHash` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `challenge_submissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `challenge_submissions_submissionId_unique` UNIQUE(`submissionId`)
);
--> statement-breakpoint
ALTER TABLE `ai_agents` ADD `language` varchar(16);--> statement-breakpoint
ALTER TABLE `ai_agents` ADD `industriesJson` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `hasExistingTrust` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `existingEntityName` varchar(255);--> statement-breakpoint
ALTER TABLE `clients` ADD `existingEntityPhone` varchar(50);--> statement-breakpoint
ALTER TABLE `clients` ADD `existingEntityAddressLine1` varchar(255);--> statement-breakpoint
ALTER TABLE `clients` ADD `existingEntityAddressLine2` varchar(255);--> statement-breakpoint
ALTER TABLE `clients` ADD `existingEntityCity` varchar(120);--> statement-breakpoint
ALTER TABLE `clients` ADD `existingEntityState` varchar(40);--> statement-breakpoint
ALTER TABLE `clients` ADD `existingEntityPostalCode` varchar(20);--> statement-breakpoint
ALTER TABLE `clients` ADD `existingEntityCountry` varchar(2);--> statement-breakpoint
ALTER TABLE `oasis_npcs` ADD `language` varchar(16);--> statement-breakpoint
CREATE INDEX `agent_arch_maps_workspace_idx` ON `agent_architecture_maps` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `agent_arch_maps_user_idx` ON `agent_architecture_maps` (`userId`);--> statement-breakpoint
CREATE INDEX `troo_placements_world_idx` ON `troo_world_placements` (`worldId`);--> statement-breakpoint
CREATE INDEX `troo_placements_world_element_idx` ON `troo_world_placements` (`worldId`,`elementKey`);--> statement-breakpoint
CREATE INDEX `challenge_audit_log_submission_idx` ON `challenge_audit_log` (`submissionId`);--> statement-breakpoint
CREATE INDEX `challenge_credits_user_idx` ON `challenge_credits` (`userId`);--> statement-breakpoint
CREATE INDEX `challenge_credits_challenge_key_idx` ON `challenge_credits` (`challengeKey`);--> statement-breakpoint
CREATE INDEX `challenge_submissions_user_idx` ON `challenge_submissions` (`userId`);--> statement-breakpoint
CREATE INDEX `challenge_submissions_challenge_key_idx` ON `challenge_submissions` (`challengeKey`);--> statement-breakpoint
CREATE INDEX `challenge_submissions_status_idx` ON `challenge_submissions` (`status`);