-- World Commerce Nodes: stores, services, consultations, ad_space, etc.
-- See docs: World Economy Layer
CREATE TABLE IF NOT EXISTS `world_commerce_nodes` (
  `id` varchar(36) NOT NULL,
  `worldId` varchar(36) NOT NULL,
  `ownerId` int NOT NULL,
  `nodeType` enum('store','service','consultation','ad_space','product_display','event_space','course','npc_service') NOT NULL,
  `placementJson` json NOT NULL,
  `assetId` varchar(36),
  `title` varchar(120) NOT NULL,
  `description` text,
  `agentId` varchar(80),
  `entityId` varchar(36),
  `priceToken` int,
  `priceUSD` int,
  `revenueShare` int,
  `status` enum('draft','active','paused','archived') NOT NULL DEFAULT 'active',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `world_commerce_nodes_world_idx` (`worldId`),
  KEY `world_commerce_nodes_owner_idx` (`ownerId`),
  KEY `world_commerce_nodes_type_idx` (`nodeType`),
  KEY `world_commerce_nodes_status_idx` (`status`)
);
