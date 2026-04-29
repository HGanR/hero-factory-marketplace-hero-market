-- Property Twin v1.1 alignment migration (run once per database).
--
-- 1) If your install used the legacy table name `properties`, rename it:
--    RENAME TABLE `properties` TO `property_twin_properties`;
--
-- 2) Add reconstruction result JSON (worker output contract).
--    If the column already exists, skip or remove this line.

ALTER TABLE `property_twin_jobs` ADD COLUMN `resultJson` JSON NULL;
