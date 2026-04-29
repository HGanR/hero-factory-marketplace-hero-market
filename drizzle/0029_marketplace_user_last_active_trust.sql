-- Explicit per-user active trust pointer for GET /api/trust-records/me (not inferred from trust.updatedAt alone).
ALTER TABLE `marketplace_users` ADD COLUMN `lastActiveTrustId` varchar(36) NULL AFTER `lastLogin`;
