-- Universal Identity Layer: Troo ID + wallet linkage
CREATE TABLE IF NOT EXISTS `troo_identities` (
  `id` varchar(36) NOT NULL,
  `trooId` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `troo_identities_troo_id_uidx` (`trooId`),
  UNIQUE KEY `troo_identities_user_uidx` (`userId`)
);

CREATE TABLE IF NOT EXISTS `troo_wallet_links` (
  `id` varchar(36) NOT NULL,
  `identityId` varchar(36) NOT NULL,
  `chain` varchar(32) NOT NULL,
  `address` varchar(128) NOT NULL,
  `verifiedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `troo_wallet_links_identity_idx` (`identityId`),
  UNIQUE KEY `troo_wallet_links_chain_address_uidx` (`chain`, `address`)
);
