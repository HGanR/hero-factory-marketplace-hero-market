-- Bentley SLI v2: website grade JSON + pipeline version on runs.

ALTER TABLE `lead_analyses`
  ADD COLUMN `websiteGradeJson` JSON NULL AFTER `scoreExplanationJson`;

ALTER TABLE `lead_analysis_runs`
  ADD COLUMN `pipelineVersion` VARCHAR(64) NOT NULL DEFAULT 'bentley-sli-v2' AFTER `modelVersion`;
