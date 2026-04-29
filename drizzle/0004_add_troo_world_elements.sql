CREATE TABLE `troo_world_elements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`worldId` varchar(64) NOT NULL DEFAULT 'default',
	`type` enum('tree','street_light','bench','road_segment','crosswalk','bush','fountain') NOT NULL,
	`posX` decimal(12,4) NOT NULL DEFAULT '0',
	`posY` decimal(12,4) NOT NULL DEFAULT '0',
	`posZ` decimal(12,4) NOT NULL DEFAULT '0',
	`rotY` decimal(12,4) NOT NULL DEFAULT '0',
	`scale` decimal(12,4) NOT NULL DEFAULT '1',
	`colorHex` int,
	`color2Hex` int,
	`label` varchar(128),
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `troo_world_elements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `troo_elements_world_idx` ON `troo_world_elements` (`worldId`);
