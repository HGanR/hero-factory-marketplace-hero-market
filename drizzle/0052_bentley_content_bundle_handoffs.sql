-- Bentley SLI → AI Revenue OS / Content Bundle structured handoffs (operator-initiated).

CREATE TABLE IF NOT EXISTS `bentley_content_bundle_handoffs` (
  `id` VARCHAR(36) NOT NULL,
  `userId` INT NOT NULL,
  `uploadId` VARCHAR(36) NULL,
  `runId` VARCHAR(36) NULL,
  `payloadJson` JSON NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `bentley_cb_handoff_user_idx` (`userId`),
  INDEX `bentley_cb_handoff_created_idx` (`createdAt`),
  CONSTRAINT `bentley_cb_handoff_user_fk` FOREIGN KEY (`userId`) REFERENCES `marketplace_users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
