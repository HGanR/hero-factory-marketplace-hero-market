-- Add NFT columns to worlds table (required by Drizzle schema)
-- Run in TiDB Cloud if Create World returns 500
-- Safe to run multiple times (uses IF NOT EXISTS)

USE `hero-market`;

ALTER TABLE `worlds` ADD COLUMN IF NOT EXISTS `ownerWallet` varchar(42) NULL;
ALTER TABLE `worlds` ADD COLUMN IF NOT EXISTS `nftContractAddress` varchar(42) NULL;
ALTER TABLE `worlds` ADD COLUMN IF NOT EXISTS `nftTokenId` varchar(80) NULL;
ALTER TABLE `worlds` ADD COLUMN IF NOT EXISTS `saleStatus` enum('not_listed','listed','sold') NULL;
CREATE INDEX IF NOT EXISTS `worlds_owner_wallet_idx` ON `worlds` (`ownerWallet`);
