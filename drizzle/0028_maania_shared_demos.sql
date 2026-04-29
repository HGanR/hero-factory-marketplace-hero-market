CREATE TABLE IF NOT EXISTS `maania_shared_demos` (
  `id` varchar(36) NOT NULL,
  `slug` varchar(16) NOT NULL,
  `kind` enum('buyer','ret') NOT NULL,
  `title` varchar(255) NOT NULL,
  `payloadJson` text NOT NULL,
  `schemaJson` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `maania_shared_demos_slug_unique` (`slug`)
);
