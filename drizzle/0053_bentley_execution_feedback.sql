-- Phase 4D: Content deployment prep + tracked leads (execution feedback loop; no auto-posting).

CREATE TABLE IF NOT EXISTS `bentley_content_deployments` (
  `id` varchar(36) NOT NULL,
  `userId` int NOT NULL,
  `platform` varchar(64) NOT NULL,
  `title` varchar(512) NOT NULL DEFAULT '',
  `hook` text,
  `caption` text,
  `cta` text,
  `hashtagsJson` json,
  `fullExportJson` json NOT NULL,
  `contentEngineHash` varchar(64) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `postedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bentley_cd_user_idx` (`userId`),
  KEY `bentley_cd_status_idx` (`userId`, `status`),
  CONSTRAINT `bentley_cd_user_fk` FOREIGN KEY (`userId`) REFERENCES `marketplace_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bentley_tracked_leads` (
  `id` varchar(36) NOT NULL,
  `userId` int NOT NULL,
  `platform` varchar(64) NOT NULL,
  `handle` varchar(256) NOT NULL,
  `comment` text NOT NULL,
  `painType` varchar(128) NOT NULL DEFAULT '',
  `intentScore` decimal(8,4) NOT NULL DEFAULT 0.0000,
  `status` varchar(32) NOT NULL DEFAULT 'new',
  `source` varchar(32) NOT NULL,
  `leadRecordId` varchar(36) DEFAULT NULL,
  `contentDeploymentId` varchar(36) DEFAULT NULL,
  `analysisRunId` varchar(36) DEFAULT NULL,
  `rawPayloadJson` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bentley_tl_user_leadrec` (`userId`, `leadRecordId`),
  KEY `bentley_tl_user_status` (`userId`, `status`),
  KEY `bentley_tl_source` (`userId`, `source`),
  CONSTRAINT `bentley_tl_user_fk` FOREIGN KEY (`userId`) REFERENCES `marketplace_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
