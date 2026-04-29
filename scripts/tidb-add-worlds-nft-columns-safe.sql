-- Add NFT columns to worlds table (safe to run multiple times)
-- TiDB supports IF NOT EXISTS - no errors if columns/index already exist

USE `hero-market`;

ALTER TABLE `worlds` ADD COLUMN IF NOT EXISTS `ownerWallet` varchar(42) NULL;
ALTER TABLE `worlds` ADD COLUMN IF NOT EXISTS `nftContractAddress` varchar(42) NULL;
ALTER TABLE `worlds` ADD COLUMN IF NOT EXISTS `nftTokenId` varchar(80) NULL;
ALTER TABLE `worlds` ADD COLUMN IF NOT EXISTS `saleStatus` enum('not_listed','listed','sold') NULL;
CREATE INDEX IF NOT EXISTS `worlds_owner_wallet_idx` ON `worlds` (`ownerWallet`);
