-- Bentley SLI v3: extraction coverage, lead type, commercial readiness, operator enum migration.
-- Split ALTERs so ADD ... AFTER does not reference a column added in the same statement (MySQL 5.7 / MariaDB).

ALTER TABLE `lead_analyses`
  ADD COLUMN `leadType` VARCHAR(64) NOT NULL DEFAULT 'local_service_business' AFTER `inferredVertical`;

ALTER TABLE `lead_analyses`
  ADD COLUMN `commercialReadiness` VARCHAR(16) NOT NULL DEFAULT 'moderate' AFTER `leadType`;

ALTER TABLE `lead_analyses`
  ADD COLUMN `coverageJson` JSON NULL AFTER `websiteGradeJson`;

-- Map legacy operator_status values to controlled enum (new, reviewing, shortlisted, contacted_manually, not_a_fit, revisit_later)
UPDATE `lead_analyses` SET `operatorStatus` = 'reviewing' WHERE `operatorStatus` = 'in_progress';
UPDATE `lead_analyses` SET `operatorStatus` = 'shortlisted' WHERE `operatorStatus` = 'done';
UPDATE `lead_analyses` SET `operatorStatus` = 'revisit_later' WHERE `operatorStatus` = 'snoozed';
UPDATE `lead_analyses` SET `operatorStatus` = 'not_a_fit' WHERE `operatorStatus` = 'discarded';
