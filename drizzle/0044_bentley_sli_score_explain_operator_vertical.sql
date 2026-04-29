-- Bentley SLI: score explainability, inferred vertical, operator workflow fields.
--
-- MySQL (esp. 5.7 / some MariaDB) does not treat columns added in the same ALTER as valid
-- targets for a later ADD ... AFTER `newColumn`. Split statements so `scoreExplanationJson`
-- exists before columns that use AFTER `scoreExplanationJson`.

ALTER TABLE `lead_analyses`
  ADD COLUMN `inferredVertical` VARCHAR(64) NOT NULL DEFAULT 'general_service_business' AFTER `maturityStage`,
  ADD COLUMN `scoreExplanationJson` JSON NULL AFTER `rawAnalysisJson`;

ALTER TABLE `lead_analyses`
  ADD COLUMN `operatorStatus` VARCHAR(32) NOT NULL DEFAULT 'new' AFTER `scoreExplanationJson`;

ALTER TABLE `lead_analyses`
  ADD COLUMN `operatorPriority` VARCHAR(16) NOT NULL DEFAULT 'normal' AFTER `operatorStatus`;

ALTER TABLE `lead_analyses`
  ADD COLUMN `operatorNotes` TEXT NULL AFTER `operatorPriority`;

ALTER TABLE `lead_analyses`
  ADD COLUMN `manuallyReviewedAt` TIMESTAMP NULL AFTER `operatorNotes`;
