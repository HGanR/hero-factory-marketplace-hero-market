-- Site Builder paid fulfillment slice (WEBSITE / Claude worker handoff spine)
-- Commit 1: schema contract only — no routes, executors, or deploy automation.

CREATE TABLE IF NOT EXISTS `claude_worker_api_keys` (
  `id` VARCHAR(36) NOT NULL,
  `ownerAdminUserId` INT NOT NULL,
  `createdByAdminUserId` INT NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `keyPrefix` VARCHAR(24) NOT NULL,
  `keyHash` VARCHAR(64) NOT NULL,
  `scopesJson` TEXT NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `revokedAt` TIMESTAMP NULL,
  `expiresAt` TIMESTAMP NULL,
  `lastUsedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `claude_worker_api_keys_keyHash_uniq` (`keyHash`),
  KEY `claude_worker_api_keys_owner_idx` (`ownerAdminUserId`),
  KEY `claude_worker_api_keys_active_idx` (`isActive`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `payment_confirmations` (
  `id` VARCHAR(36) NOT NULL,
  `clientId` VARCHAR(36) NULL,
  `marketplaceUserId` INT NULL,
  `provider` VARCHAR(32) NOT NULL,
  `externalRef` VARCHAR(191) NULL,
  `amountCents` INT NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
  `status` ENUM('pending','confirmed','failed') NOT NULL DEFAULT 'pending',
  `confirmedAt` TIMESTAMP NULL,
  `confirmedByAdminUserId` INT NULL,
  `evidenceJson` LONGTEXT NULL,
  `consumedAt` TIMESTAMP NULL,
  `consumedByOrderId` VARCHAR(36) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `payment_confirmations_client_status_idx` (`clientId`, `status`),
  KEY `payment_confirmations_consumed_order_idx` (`consumedByOrderId`),
  UNIQUE KEY `payment_confirmations_provider_ref_uniq` (`provider`, `externalRef`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `client_service_orders` (
  `id` VARCHAR(36) NOT NULL,
  `clientId` VARCHAR(36) NOT NULL,
  `marketplaceUserId` INT NULL,
  `primaryService` VARCHAR(32) NOT NULL,
  `requestedServicesJson` TEXT NULL,
  `pipelineStage` VARCHAR(64) NOT NULL,
  `paymentConfirmationId` VARCHAR(36) NOT NULL,
  `assignedDepartment` VARCHAR(32) NOT NULL,
  `salesSummaryText` TEXT NULL,
  `consentJson` TEXT NULL,
  `requestedDeliverableJson` TEXT NULL,
  `executiveHandoffJson` LONGTEXT NULL,
  `source` VARCHAR(32) NOT NULL,
  `claudeWorkerApiKeyId` VARCHAR(36) NULL,
  `ownerAdminUserId` INT NOT NULL,
  `claudeIdempotencyKey` VARCHAR(128) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `client_service_orders_owner_stage_idx` (`ownerAdminUserId`, `pipelineStage`),
  KEY `client_service_orders_client_idx` (`clientId`),
  KEY `client_service_orders_payment_idx` (`paymentConfirmationId`),
  UNIQUE KEY `client_service_orders_worker_idempotency_uniq` (`claudeWorkerApiKeyId`, `claudeIdempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `client_service_order_events` (
  `id` VARCHAR(36) NOT NULL,
  `orderId` VARCHAR(36) NOT NULL,
  `actorType` VARCHAR(32) NOT NULL,
  `actorId` VARCHAR(191) NULL,
  `fromStage` VARCHAR(64) NULL,
  `toStage` VARCHAR(64) NOT NULL,
  `payloadJson` LONGTEXT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `client_service_order_events_order_created_idx` (`orderId`, `createdAt`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `fulfillment_deliverables` (
  `id` VARCHAR(36) NOT NULL,
  `orderId` VARCHAR(36) NOT NULL,
  `department` VARCHAR(32) NOT NULL,
  `artifactType` VARCHAR(64) NOT NULL,
  `artifactRef` VARCHAR(191) NULL,
  `ownerReviewStatus` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fulfillment_deliverables_order_uniq` (`orderId`),
  KEY `fulfillment_deliverables_department_idx` (`department`)
);
