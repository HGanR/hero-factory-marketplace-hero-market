-- Migration: Add Company Tables for Parent Company + C-Corp Wizard
-- Run this against your MySQL database

-- Companies table
CREATE TABLE `companies` (
  `id` varchar(36) NOT NULL,
  `userId` int NOT NULL,
  `companyName` varchar(255) NOT NULL,
  `formationState` varchar(2) NOT NULL,
  `companyKind` enum('parent_holding_company','operating_company') NOT NULL,
  `corpType` enum('c_corp','s_corp','llc','unknown') NOT NULL,
  `parentStructure` enum('single_parent_single_sub','single_parent_multi_sub','parent_only','unknown') NOT NULL,
  `registeredAgentPlanned` boolean DEFAULT FALSE,
  `authorizedShares` int DEFAULT NULL,
  `parValue` decimal(10,6) DEFAULT NULL,
  `fiscalYearEndMonth` int DEFAULT NULL,
  `boardSize` int DEFAULT NULL,
  `officersPlanned` boolean DEFAULT TRUE,
  `initialBoardConsentPlanned` boolean DEFAULT TRUE,
  `publicCompanyId` varchar(20) DEFAULT NULL,
  `status` enum('draft','counsel_reviewed','board_adopted','execution_ready') DEFAULT 'draft',
  `draftJson` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `publicCompanyId` (`publicCompanyId`),
  KEY `userId` (`userId`),
  CONSTRAINT `companies_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Company affiliations table
CREATE TABLE `company_affiliations` (
  `id` varchar(36) NOT NULL,
  `userId` int NOT NULL,
  `affiliationType` enum('parent_subsidiary','company_trust','company_family_office','company_foundation','company_dao') NOT NULL,
  `parentCompanyId` varchar(36) NOT NULL,
  `subsidiaryCompanyId` varchar(36) DEFAULT NULL,
  `trustId` varchar(36) DEFAULT NULL,
  `familyOfficeId` varchar(36) DEFAULT NULL,
  `foundationId` varchar(36) DEFAULT NULL,
  `subsidiaryKind` enum('operating','ip_holdco','real_estate','other') DEFAULT NULL,
  `ownershipPercentage` int DEFAULT NULL,
  `relationshipRole` varchar(100) DEFAULT NULL,
  `notes` text,
  `createdBy` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_parent_subsidiary` (`parentCompanyId`,`subsidiaryCompanyId`),
  UNIQUE KEY `unique_company_trust` (`parentCompanyId`,`trustId`),
  UNIQUE KEY `unique_company_family_office` (`parentCompanyId`,`familyOfficeId`),
  UNIQUE KEY `unique_company_foundation` (`parentCompanyId`,`foundationId`),
  KEY `userId` (`userId`),
  KEY `parentCompanyId` (`parentCompanyId`),
  KEY `subsidiaryCompanyId` (`subsidiaryCompanyId`),
  KEY `trustId` (`trustId`),
  CONSTRAINT `company_affiliations_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `company_affiliations_parentCompanyId_fkey` FOREIGN KEY (`parentCompanyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `company_affiliations_subsidiaryCompanyId_fkey` FOREIGN KEY (`subsidiaryCompanyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `company_affiliations_trustId_fkey` FOREIGN KEY (`trustId`) REFERENCES `trusts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Company sequences table
CREATE TABLE `company_sequences` (
  `id` varchar(36) NOT NULL,
  `scope` varchar(191) NOT NULL,
  `currentValue` int NOT NULL DEFAULT '0',
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `scope` (`scope`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add indexes for performance
ALTER TABLE `companies` ADD INDEX `companies_userId_idx` (`userId`);
ALTER TABLE `companies` ADD INDEX `companies_status_idx` (`status`);
ALTER TABLE `company_affiliations` ADD INDEX `company_affiliations_userId_idx` (`userId`);
ALTER TABLE `company_affiliations` ADD INDEX `company_affiliations_parentCompanyId_idx` (`parentCompanyId`);
ALTER TABLE `company_affiliations` ADD INDEX `company_affiliations_affiliationType_idx` (`affiliationType`);








