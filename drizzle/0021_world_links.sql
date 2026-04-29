-- World Links: network connectivity between worlds (portals, teleports)
CREATE TABLE IF NOT EXISTS `world_links` (
  `id` varchar(36) NOT NULL,
  `fromWorldId` varchar(36) NOT NULL,
  `toWorldId` varchar(36) NOT NULL,
  `label` varchar(120),
  `placementJson` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `world_links_from_idx` (`fromWorldId`),
  KEY `world_links_to_idx` (`toWorldId`)
);
