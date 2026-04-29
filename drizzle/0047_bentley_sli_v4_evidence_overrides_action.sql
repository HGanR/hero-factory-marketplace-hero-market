-- Bentley SLI v4: evidence, action rationale, operator overrides on inferred fields.
-- One ADD per ALTER when using AFTER a column introduced in this migration chain (MySQL compatibility).

ALTER TABLE `lead_analyses`
  ADD COLUMN `evidenceJson` JSON NULL AFTER `coverageJson`;

ALTER TABLE `lead_analyses`
  ADD COLUMN `actionRationale` TEXT NULL AFTER `suggestedNextMove`;

ALTER TABLE `lead_analyses`
  ADD COLUMN `operatorOverrideLeadType` VARCHAR(64) NULL AFTER `operatorNotes`;

ALTER TABLE `lead_analyses`
  ADD COLUMN `operatorOverrideCommercialReadiness` VARCHAR(16) NULL AFTER `operatorOverrideLeadType`;

ALTER TABLE `lead_analyses`
  ADD COLUMN `operatorOverrideBestOfferAngle` TEXT NULL AFTER `operatorOverrideCommercialReadiness`;

ALTER TABLE `lead_analyses`
  ADD COLUMN `operatorOverrideWeakSpotsJson` JSON NULL AFTER `operatorOverrideBestOfferAngle`;
