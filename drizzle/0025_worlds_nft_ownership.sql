ALTER TABLE `worlds` ADD COLUMN `ownerWallet` varchar(42) NULL;
ALTER TABLE `worlds` ADD COLUMN `nftContractAddress` varchar(42) NULL;
ALTER TABLE `worlds` ADD COLUMN `nftTokenId` varchar(80) NULL;
ALTER TABLE `worlds` ADD COLUMN `saleStatus` enum('not_listed','listed','sold') NULL;
CREATE INDEX `worlds_owner_wallet_idx` ON `worlds` (`ownerWallet`);
