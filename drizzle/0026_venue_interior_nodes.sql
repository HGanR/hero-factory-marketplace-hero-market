-- Venue Interior Nodes: interaction nodes inside placed venue GLBs in World Explorer
-- See docs/VENUE_INTERIOR_NODE_IMPLEMENTATION_PLAN.md
CREATE TABLE IF NOT EXISTS `venue_interior_nodes` (
  `id` varchar(36) NOT NULL,
  `worldId` varchar(36) NOT NULL,
  `placementId` varchar(64) NOT NULL,
  `title` varchar(120) NOT NULL,
  `slug` varchar(80),
  `nodeType` varchar(40) NOT NULL DEFAULT 'voice_room',
  `description` text,
  `posX` decimal(12,4) NOT NULL DEFAULT 0,
  `posY` decimal(12,4) NOT NULL DEFAULT 0,
  `posZ` decimal(12,4) NOT NULL DEFAULT 0,
  `rotY` decimal(12,4) NOT NULL DEFAULT 0,
  `isActive` boolean NOT NULL DEFAULT true,
  `accessType` varchar(24) NOT NULL DEFAULT 'public',
  `roomId` varchar(120) NOT NULL,
  `createdByUserId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `venue_interior_nodes_room_uidx` (`roomId`),
  KEY `venue_interior_nodes_world_idx` (`worldId`),
  KEY `venue_interior_nodes_placement_idx` (`worldId`, `placementId`),
  KEY `venue_interior_nodes_room_idx` (`roomId`)
);
