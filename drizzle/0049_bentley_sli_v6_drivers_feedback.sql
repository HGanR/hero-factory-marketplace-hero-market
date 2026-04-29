-- Bentley SLI v6: top lead drivers + per-finding operator feedback (calibration).

ALTER TABLE `lead_analyses`
  ADD COLUMN `topLeadDriversJson` JSON NULL AFTER `findingConfidenceJson`;

ALTER TABLE `lead_analyses`
  ADD COLUMN `operatorFeedbackLeadType` VARCHAR(32) NULL AFTER `operatorOverrideWeakSpotsReason`;

ALTER TABLE `lead_analyses`
  ADD COLUMN `operatorFeedbackCommercialReadiness` VARCHAR(32) NULL AFTER `operatorFeedbackLeadType`;

ALTER TABLE `lead_analyses`
  ADD COLUMN `operatorFeedbackWeakSpots` VARCHAR(32) NULL AFTER `operatorFeedbackCommercialReadiness`;

ALTER TABLE `lead_analyses`
  ADD COLUMN `operatorFeedbackBestOfferAngle` VARCHAR(32) NULL AFTER `operatorFeedbackWeakSpots`;
