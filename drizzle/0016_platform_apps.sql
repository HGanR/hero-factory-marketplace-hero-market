-- Creator Marketplace: platform_apps, user_installed_apps
CREATE TABLE IF NOT EXISTS `platform_apps` (
  `id` varchar(36) NOT NULL,
  `slug` varchar(80) NOT NULL,
  `name` varchar(120) NOT NULL,
  `description` text,
  `category` varchar(60) NOT NULL,
  `creatorId` int NOT NULL,
  `version` int NOT NULL DEFAULT 1,
  `priceToken` int,
  `priceUSD` int,
  `revenueShare` int,
  `installCount` int NOT NULL DEFAULT 0,
  `status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
  `manifestJson` json,
  `capabilitiesJson` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `platform_apps_slug_uidx` (`slug`),
  KEY `platform_apps_creator_idx` (`creatorId`),
  KEY `platform_apps_category_idx` (`category`),
  KEY `platform_apps_status_idx` (`status`)
);

CREATE TABLE IF NOT EXISTS `user_installed_apps` (
  `id` varchar(36) NOT NULL,
  `userId` int NOT NULL,
  `appId` varchar(36) NOT NULL,
  `installedAt` timestamp NOT NULL DEFAULT (now()),
  `scope` enum('world','entity','dashboard','agent') NOT NULL,
  `worldId` varchar(36),
  `entityId` varchar(36),
  `agentId` varchar(80),
  `configJson` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `user_installed_apps_user_idx` (`userId`),
  KEY `user_installed_apps_app_idx` (`appId`),
  KEY `user_installed_apps_scope_idx` (`scope`),
  KEY `user_installed_apps_user_app_idx` (`userId`,`appId`)
);
