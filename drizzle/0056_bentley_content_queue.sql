-- Phase 4J — Content distribution queue (draft → ready → posted) + batch linkage

CREATE TABLE IF NOT EXISTS `bentley_content_queue_items` (
  `id` varchar(36) NOT NULL,
  `userId` int NOT NULL,
  `generationVariantId` varchar(36) NULL,
  `batchId` varchar(36) NULL,
  `variationIndex` int NULL,
  `queueStatus` varchar(20) NOT NULL DEFAULT 'draft',
  `platformFormat` varchar(32) NOT NULL DEFAULT 'multi',
  `title` varchar(512) NOT NULL DEFAULT '',
  `payloadJson` json NOT NULL,
  `contentDeploymentId` varchar(36) NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bentley_cq_user_status` (`userId`, `queueStatus`),
  KEY `bentley_cq_user_batch` (`userId`, `batchId`),
  KEY `bentley_cq_user_genvar` (`userId`, `generationVariantId`),
  CONSTRAINT `bentley_cq_user_fk` FOREIGN KEY (`userId`) REFERENCES `marketplace_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
