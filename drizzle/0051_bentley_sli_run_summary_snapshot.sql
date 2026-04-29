-- Frozen batch summary JSON at run completion (for comparison / audit).
ALTER TABLE `lead_analysis_runs`
  ADD COLUMN `summarySnapshotJson` JSON NULL AFTER `failureCount`;
