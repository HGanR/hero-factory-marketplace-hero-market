-- Read-only presentation links: opaque token per property (no login).
ALTER TABLE `property_twin_properties`
  ADD COLUMN `publicShareToken` varchar(64) DEFAULT NULL AFTER `ownerUserId`;

CREATE UNIQUE INDEX `idx_property_twin_properties_public_share`
  ON `property_twin_properties` (`publicShareToken`);
