-- Property Twin tables (TiDB / MySQL). Fresh install.
-- Legacy rename: if you still have `properties` from an older build, run
--   drizzle/property_twin_migrate_002.sql

CREATE TABLE IF NOT EXISTS `property_twin_properties` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(256) NOT NULL,
  `slug` varchar(128) DEFAULT NULL,
  `description` text,
  `ownerWallet` varchar(128) DEFAULT NULL,
  `ownerUserId` int DEFAULT NULL,
  `publicShareToken` varchar(64) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_property_twin_properties_owner` (`ownerWallet`),
  KEY `idx_property_twin_properties_owner_user` (`ownerUserId`),
  UNIQUE KEY `idx_property_twin_properties_public_share` (`publicShareToken`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `property_twin_assets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `propertyId` int NOT NULL,
  `kind` enum('exterior','interior','landscape','video','floor_plan') NOT NULL,
  `url` varchar(1024) NOT NULL,
  `mimeType` varchar(128) DEFAULT NULL,
  `originalFilename` varchar(512) DEFAULT NULL,
  `bytes` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `idx_pt_assets_property` (`propertyId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `property_twin_jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `propertyId` int NOT NULL,
  `mode` enum('photogrammetry','gaussian','neural','hybrid','manual') NOT NULL DEFAULT 'photogrammetry',
  `status` enum('draft','queued','running','succeeded','failed','cancelled') NOT NULL DEFAULT 'draft',
  `progress` int NOT NULL DEFAULT 0,
  `errorMessage` text,
  `inputAssetIds` json DEFAULT NULL,
  `outputUrl` varchar(1024) DEFAULT NULL,
  `resultJson` json DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pt_jobs_property` (`propertyId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `property_twin_nodes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `propertyId` int NOT NULL,
  `zone` varchar(64) NOT NULL DEFAULT 'general',
  `label` varchar(256) NOT NULL,
  `nodeType` varchar(64) NOT NULL DEFAULT 'planning',
  `sortOrder` int NOT NULL DEFAULT 0,
  `payload` json DEFAULT NULL,
  `anchorX` double DEFAULT NULL,
  `anchorY` double DEFAULT NULL,
  `anchorZ` double DEFAULT NULL,
  `estimatedCost` int DEFAULT NULL,
  `estimatedValueLift` int DEFAULT NULL,
  `roiPercent` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pt_nodes_property` (`propertyId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
