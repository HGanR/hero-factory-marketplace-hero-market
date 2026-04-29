-- Phase 4E: Outcome tracking + attribution snapshots for conversion reporting.

ALTER TABLE `bentley_tracked_leads`
  ADD COLUMN `uploadId` varchar(36) NULL DEFAULT NULL AFTER `analysisRunId`,
  ADD COLUMN `contactedAt` timestamp NULL DEFAULT NULL,
  ADD COLUMN `bookedAt` timestamp NULL DEFAULT NULL,
  ADD COLUMN `closedAt` timestamp NULL DEFAULT NULL,
  ADD COLUMN `lostAt` timestamp NULL DEFAULT NULL,
  ADD COLUMN `estimatedValue` decimal(14,2) NULL DEFAULT NULL,
  ADD COLUMN `closedValue` decimal(14,2) NULL DEFAULT NULL,
  ADD COLUMN `outcomeNotes` text NULL,
  ADD COLUMN `lossReason` varchar(512) NULL DEFAULT NULL,
  ADD COLUMN `attributionConfidence` decimal(4,3) NULL DEFAULT NULL,
  ADD COLUMN `attributionSnapshotJson` json NULL,
  ADD COLUMN `commercialReadiness` varchar(32) NULL DEFAULT NULL;

ALTER TABLE `bentley_tracked_leads`
  ADD KEY `bentley_tl_upload_idx` (`userId`, `uploadId`),
  ADD KEY `bentley_tl_deploy_idx` (`userId`, `contentDeploymentId`);
