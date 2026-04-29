-- Bentley SLI v5: finding-level confidence + operator override reason fields.

ALTER TABLE `lead_analyses`
  ADD COLUMN `findingConfidenceJson` JSON NULL AFTER `evidenceJson`;

ALTER TABLE `lead_analyses`
  ADD COLUMN `operatorOverrideLeadTypeReason` TEXT NULL AFTER `operatorOverrideWeakSpotsJson`;

ALTER TABLE `lead_analyses`
  ADD COLUMN `operatorOverrideCommercialReadinessReason` TEXT NULL AFTER `operatorOverrideLeadTypeReason`;

ALTER TABLE `lead_analyses`
  ADD COLUMN `operatorOverrideBestOfferAngleReason` TEXT NULL AFTER `operatorOverrideCommercialReadinessReason`;

ALTER TABLE `lead_analyses`
  ADD COLUMN `operatorOverrideWeakSpotsReason` TEXT NULL AFTER `operatorOverrideBestOfferAngleReason`;
