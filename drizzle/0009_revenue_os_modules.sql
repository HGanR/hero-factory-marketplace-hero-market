-- Revenue OS Module Tables (clean migration - run if 0006_add_revenue_os_module_tables has conflicts)
-- Tables: revenue_os_funnels, revenue_os_funnel_pages, revenue_os_message_sequences, revenue_os_sequence_steps,
--         market_sources, market_scans, capital_plans, channel_spend_snapshots

CREATE TABLE IF NOT EXISTS `revenue_os_funnels` (
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
CREATE TABLE IF NOT EXISTS `revenue_os_funnel_pages` (
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
CREATE TABLE IF NOT EXISTS `revenue_os_message_sequences` (
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
CREATE TABLE IF NOT EXISTS `revenue_os_sequence_steps` (
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
CREATE TABLE IF NOT EXISTS `market_sources` (
	`id` varchar(36) NOT NULL,
	`name` varchar(200) NOT NULL,
	`url` varchar(512),
	`industry` varchar(120),
	`source_type` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `market_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `market_scans` (
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
CREATE TABLE IF NOT EXISTS `capital_plans` (
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
CREATE TABLE IF NOT EXISTS `channel_spend_snapshots` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`client_id` varchar(36) NOT NULL DEFAULT '',
	`month` varchar(7) NOT NULL,
	`channel` varchar(64) NOT NULL,
	`spend` decimal(18,2) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `channel_spend_snapshots_id` PRIMARY KEY(`id`)
);
