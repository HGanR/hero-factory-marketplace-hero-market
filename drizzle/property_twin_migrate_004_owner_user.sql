-- Property Twin — ownership column for session-based access control

ALTER TABLE `property_twin_properties` ADD COLUMN `ownerUserId` INT NULL;
CREATE INDEX `idx_property_twin_properties_owner_user` ON `property_twin_properties` (`ownerUserId`);
