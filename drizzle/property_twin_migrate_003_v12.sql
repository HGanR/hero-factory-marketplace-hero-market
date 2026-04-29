-- Property Twin v1.2 — node anchors + per-node ROI columns

ALTER TABLE `property_twin_nodes`
  ADD COLUMN `anchorX` DOUBLE NULL,
  ADD COLUMN `anchorY` DOUBLE NULL,
  ADD COLUMN `anchorZ` DOUBLE NULL,
  ADD COLUMN `estimatedCost` INT NULL,
  ADD COLUMN `estimatedValueLift` INT NULL,
  ADD COLUMN `roiPercent` INT NULL;
