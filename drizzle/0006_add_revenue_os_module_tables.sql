CREATE TABLE `capital_plans` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`client_id` varchar(36) NOT NULL DEFAULT '',
	`trust_id` varchar(36) NOT NULL DEFAULT '',
	`ad_spend` decimal(18,2) NOT NULL,
	`channel_mix` json,
	`cac` decimal(18,2) NOT NULL,
	`ltv` decimal(18,2) NOT NULL,
	`margins` decimal(5,4),
	`payload` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `capital_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `channel_spend_snapshots` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`client_id` varchar(36) NOT NULL DEFAULT '',
	`month` varchar(7) NOT NULL,
	`channel` varchar(64) NOT NULL,
	`spend` decimal(18,2) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `channel_spend_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `market_scans` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`industry` varchar(120) NOT NULL,
	`geo` varchar(120),
	`offer_type` varchar(120),
	`payload` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `market_scans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `market_sources` (
	`id` varchar(36) NOT NULL,
	`name` varchar(200) NOT NULL,
	`url` varchar(512),
	`industry` varchar(120),
	`source_type` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `market_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oasis_npc_qa` (
	`id` int AUTO_INCREMENT NOT NULL,
	`npcId` int NOT NULL,
	`question` text NOT NULL,
	`correctAnswers` text NOT NULL,
	`wrongAnswerResponse` text NOT NULL,
	`successResponse` text,
	`orderIndex` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oasis_npc_qa_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revenue_os_funnel_pages` (
	`id` varchar(36) NOT NULL,
	`funnel_id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`sections` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `revenue_os_funnel_pages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revenue_os_funnels` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`profile_id` varchar(36),
	`client_id` varchar(36) NOT NULL DEFAULT '',
	`trust_id` varchar(36) NOT NULL DEFAULT '',
	`name` varchar(200) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'DRAFT',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `revenue_os_funnels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revenue_os_message_sequences` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`profile_id` varchar(36),
	`client_id` varchar(36) NOT NULL DEFAULT '',
	`trust_id` varchar(36) NOT NULL DEFAULT '',
	`channel` varchar(24) NOT NULL,
	`name` varchar(200) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'DRAFT',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `revenue_os_message_sequences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revenue_os_sequence_steps` (
	`id` varchar(36) NOT NULL,
	`sequence_id` varchar(36) NOT NULL,
	`day_offset` int NOT NULL,
	`subject` varchar(500),
	`body` text NOT NULL,
	`trigger` varchar(120),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `revenue_os_sequence_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `specialist_appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentId` varchar(64) NOT NULL,
	`visitorName` varchar(200) NOT NULL,
	`visitorEmail` varchar(255) NOT NULL,
	`visitorPhone` varchar(50),
	`appointmentDate` timestamp NOT NULL,
	`appointmentType` enum('trust_consultation','family_office','general_consultation','other') NOT NULL DEFAULT 'general_consultation',
	`topic` text,
	`notes` text,
	`status` enum('scheduled','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'scheduled',
	`isNew` boolean NOT NULL DEFAULT true,
	`bookedVia` varchar(50) DEFAULT 'reality_chatbot',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `specialist_appointments_id` PRIMARY KEY(`id`),
	CONSTRAINT `specialist_appointments_appointmentId_unique` UNIQUE(`appointmentId`)
);
--> statement-breakpoint
ALTER TABLE `troo_world_elements` MODIFY COLUMN `type` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `oasis_npcs` ADD `telegramBotToken` varchar(256);--> statement-breakpoint
ALTER TABLE `oasis_npcs` ADD `telegramWebhookKey` varchar(64);--> statement-breakpoint
ALTER TABLE `oasis_npcs` ADD `telegramConnectedAt` timestamp;--> statement-breakpoint
ALTER TABLE `troo_worlds` ADD `terrainType` enum('urban-flat','green-hills','desert','snow','water-city') DEFAULT 'urban-flat' NOT NULL;--> statement-breakpoint
CREATE INDEX `capital_plan_user_idx` ON `capital_plans` (`user_id`);--> statement-breakpoint
CREATE INDEX `chspend_user_month_idx` ON `channel_spend_snapshots` (`user_id`,`month`);--> statement-breakpoint
CREATE INDEX `mkt_scan_user_idx` ON `market_scans` (`user_id`);--> statement-breakpoint
CREATE INDEX `mkt_scan_industry_idx` ON `market_scans` (`industry`);--> statement-breakpoint
CREATE INDEX `mkt_src_industry_idx` ON `market_sources` (`industry`);--> statement-breakpoint
CREATE INDEX `oasis_npc_qa_npc_idx` ON `oasis_npc_qa` (`npcId`);--> statement-breakpoint
CREATE INDEX `oasis_npc_qa_order_idx` ON `oasis_npc_qa` (`npcId`,`orderIndex`);--> statement-breakpoint
CREATE INDEX `revos_funnelpage_funnel_idx` ON `revenue_os_funnel_pages` (`funnel_id`);--> statement-breakpoint
CREATE INDEX `revos_funnel_user_idx` ON `revenue_os_funnels` (`user_id`);--> statement-breakpoint
CREATE INDEX `revos_funnel_status_idx` ON `revenue_os_funnels` (`status`);--> statement-breakpoint
CREATE INDEX `revos_seq_user_idx` ON `revenue_os_message_sequences` (`user_id`);--> statement-breakpoint
CREATE INDEX `revos_seq_channel_idx` ON `revenue_os_message_sequences` (`channel`);--> statement-breakpoint
CREATE INDEX `revos_seqstep_seq_idx` ON `revenue_os_sequence_steps` (`sequence_id`);--> statement-breakpoint
CREATE INDEX `specialist_appointments_date_idx` ON `specialist_appointments` (`appointmentDate`);--> statement-breakpoint
CREATE INDEX `specialist_appointments_status_idx` ON `specialist_appointments` (`status`);--> statement-breakpoint
CREATE INDEX `specialist_appointments_email_idx` ON `specialist_appointments` (`visitorEmail`);--> statement-breakpoint
CREATE INDEX `specialist_appointments_is_new_idx` ON `specialist_appointments` (`isNew`);