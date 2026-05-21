-- WEBSITE client delivery workspace — expiring review links (no email/SMS/deploy).

CREATE TABLE IF NOT EXISTS `fulfillment_client_delivery_tokens` (
  `id` VARCHAR(36) NOT NULL,
  `orderId` VARCHAR(36) NOT NULL,
  `deliverableId` VARCHAR(36) NOT NULL,
  `clientId` VARCHAR(36) NOT NULL,
  `ownerAdminUserId` INT NOT NULL,
  `tokenHash` VARCHAR(64) NOT NULL,
  `tokenPrefix` VARCHAR(16) NOT NULL,
  `draftVersion` INT NOT NULL DEFAULT 1,
  `status` ENUM('active','revoked','expired') NOT NULL DEFAULT 'active',
  `expiresAt` TIMESTAMP NOT NULL,
  `createdByAdminUserId` INT NOT NULL,
  `lastAccessedAt` TIMESTAMP NULL,
  `revokedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fulfillment_client_delivery_tokens_hash_uniq` (`tokenHash`),
  KEY `fulfillment_client_delivery_tokens_order_idx` (`orderId`),
  KEY `fulfillment_client_delivery_tokens_status_expires_idx` (`status`, `expiresAt`)
);
--> statement-breakpoint
ALTER TABLE `fulfillment_deliverables`
  ADD COLUMN `draftVersion` INT NOT NULL DEFAULT 1,
  ADD COLUMN `clientDeliveryStatus` ENUM(
    'not_sent',
    'workspace_active',
    'client_approved',
    'client_revision_requested'
  ) NOT NULL DEFAULT 'not_sent';
