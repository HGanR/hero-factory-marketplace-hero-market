CREATE TABLE `access_logs` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`actorUserId` int,
	`actorWallet` varchar(140),
	`action` varchar(80) NOT NULL,
	`documentId` varchar(36),
	`disclosureId` varchar(36),
	`metaJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `access_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admin_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`targetUserId` int,
	`targetEmail` varchar(320),
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` varchar(36) NOT NULL,
	`actorUserId` int,
	`action` varchar(80) NOT NULL,
	`entityType` varchar(40) NOT NULL,
	`entityId` varchar(36) NOT NULL,
	`metadataJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_notes` (
	`id` varchar(36) NOT NULL,
	`clientId` varchar(36) NOT NULL,
	`createdByUserId` int NOT NULL,
	`visibility` enum('internal','client') NOT NULL DEFAULT 'internal',
	`note` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`firstName` varchar(120) NOT NULL,
	`middleName` varchar(120),
	`lastName` varchar(120) NOT NULL,
	`suffix` varchar(40),
	`dateOfBirth` date,
	`email` varchar(320) NOT NULL,
	`phone` varchar(50),
	`addressLine1` varchar(255) NOT NULL,
	`addressLine2` varchar(255),
	`city` varchar(120) NOT NULL,
	`state` varchar(40) NOT NULL,
	`postalCode` varchar(20) NOT NULL,
	`country` varchar(2) NOT NULL DEFAULT 'US',
	`clientType` enum('individual','entity') NOT NULL DEFAULT 'individual',
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`text` text,
	`visibility` enum('public','private') NOT NULL DEFAULT 'public',
	`mediaType` enum('image','video','audio'),
	`mediaUrl` text,
	`audioUrl` text,
	`score` int NOT NULL DEFAULT 0,
	`votes` int NOT NULL DEFAULT 0,
	`superVotes` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `community_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`formationState` varchar(2) NOT NULL,
	`companyKind` enum('parent_holding_company','operating_company') NOT NULL,
	`corpType` enum('c_corp','s_corp','llc','unknown') NOT NULL,
	`parentStructure` enum('single_parent_single_sub','single_parent_multi_sub','parent_only','unknown') NOT NULL,
	`registeredAgentPlanned` boolean DEFAULT false,
	`authorizedShares` int,
	`parValue` decimal(10,6),
	`fiscalYearEndMonth` int,
	`boardSize` int,
	`officersPlanned` boolean DEFAULT true,
	`initialBoardConsentPlanned` boolean DEFAULT true,
	`publicCompanyId` varchar(20),
	`status` enum('draft','counsel_reviewed','board_adopted','execution_ready') NOT NULL DEFAULT 'draft',
	`draftJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`),
	CONSTRAINT `companies_publicCompanyId_unique` UNIQUE(`publicCompanyId`)
);
--> statement-breakpoint
CREATE TABLE `company_affiliations` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`affiliationType` enum('parent_subsidiary','company_trust','company_family_office','company_foundation','company_dao') NOT NULL,
	`parentCompanyId` varchar(36) NOT NULL,
	`subsidiaryCompanyId` varchar(36),
	`trustId` varchar(36),
	`familyOfficeId` varchar(36),
	`foundationId` varchar(36),
	`subsidiaryKind` enum('operating','ip_holdco','real_estate','other'),
	`ownershipPercentage` int,
	`notes` text,
	`relationshipRole` varchar(100),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_affiliations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `company_sequences` (
	`id` varchar(36) NOT NULL,
	`scope` varchar(191) NOT NULL,
	`currentValue` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_sequences_id` PRIMARY KEY(`id`),
	CONSTRAINT `company_sequences_scope_unique` UNIQUE(`scope`)
);
--> statement-breakpoint
CREATE TABLE `consultant_profiles` (
	`userId` int NOT NULL,
	`specialty` varchar(140) NOT NULL,
	`note` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultant_profiles_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `consultation_bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientUserId` int NOT NULL,
	`consultantUserId` int NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`status` enum('scheduled','cancelled') NOT NULL DEFAULT 'scheduled',
	`clientNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultation_bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_disclosures` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`requestId` varchar(36),
	`documentId` varchar(36) NOT NULL,
	`shareToken` varchar(191) NOT NULL,
	`status` enum('active','revoked','expired') NOT NULL DEFAULT 'active',
	`conditionsJson` text,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_disclosures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_requests` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`requestorRole` varchar(40) NOT NULL,
	`requestorEmail` varchar(320),
	`purpose` text NOT NULL,
	`requestedDocumentIdsJson` text NOT NULL,
	`status` enum('pending','approved','denied','more_info') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_notifications` (
	`id` varchar(191) NOT NULL,
	`userId` int,
	`registrationId` varchar(191),
	`recipientEmail` varchar(320) NOT NULL,
	`emailType` varchar(80) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`status` enum('PENDING','SENT','FAILED','BOUNCED') NOT NULL DEFAULT 'PENDING',
	`failureReason` text,
	`sentAt` timestamp,
	`openedAt` timestamp,
	`clickedAt` timestamp,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entity_onboardings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`jurisdiction` varchar(100) NOT NULL,
	`taxIdLast4` varchar(4) NOT NULL,
	`serviceTier` varchar(30) NOT NULL,
	`primaryContact` varchar(255),
	`contactEmail` varchar(320),
	`phone` varchar(50),
	`onboardingStatus` varchar(50) NOT NULL DEFAULT 'submitted',
	`letterOfGoodOperationUri` text,
	`articlesOfIncorporationUri` text,
	`isRevoked` boolean NOT NULL DEFAULT false,
	`revokedReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `entity_onboardings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `estate_instrument_versions` (
	`id` varchar(36) NOT NULL,
	`instrumentId` varchar(36) NOT NULL,
	`version` int NOT NULL,
	`payloadJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `estate_instrument_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `estate_instruments` (
	`id` varchar(36) NOT NULL,
	`publicId` varchar(40) NOT NULL,
	`type` enum('WILL','TESTAMENTARY_TRUST') NOT NULL,
	`status` enum('DRAFT','FINAL','REVOKED') NOT NULL DEFAULT 'DRAFT',
	`userId` int NOT NULL,
	`clientId` varchar(36),
	`entityId` varchar(36),
	`trustId` varchar(36),
	`title` varchar(255) NOT NULL,
	`jurisdiction` varchar(10),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `estate_instruments_id` PRIMARY KEY(`id`),
	CONSTRAINT `estate_instruments_publicId_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
CREATE TABLE `filing_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(255) NOT NULL,
	`userId` int NOT NULL,
	`clientId` int,
	`entityId` int,
	`orderType` enum('FOREIGN_OWNED_SMLLC_5472','PARTNERSHIP_1065') NOT NULL,
	`taxYear` int NOT NULL,
	`priceCents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`status` enum('DRAFT','PAYMENT_PENDING','INTAKE_IN_PROGRESS','READY_FOR_AGENT','IN_REVIEW','NEEDS_INFO','SUBMITTED','COMPLETED','CANCELED') NOT NULL DEFAULT 'DRAFT',
	`dueDate` timestamp,
	`extensionDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `filing_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `filing_orders_publicId_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
CREATE TABLE `filing_packets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`version` int NOT NULL,
	`payloadJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `filing_packets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `governance_assignments` (
	`id` varchar(36) NOT NULL,
	`entityType` enum('trust','family_office','foundation','dao_wrapper') NOT NULL,
	`entityId` varchar(36) NOT NULL,
	`clientProfileId` varchar(36) NOT NULL,
	`role` enum('trustee','trust_protector','committee_member','counsel_reviewer') NOT NULL,
	`powersJson` text NOT NULL,
	`triggersJson` text,
	`status` enum('active','inactive','pending_approval') NOT NULL DEFAULT 'active',
	`assignedBy` int NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	`activatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `governance_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `holder_registry` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`holderName` varchar(255) NOT NULL,
	`holderEmail` varchar(320),
	`accreditationEvidencePointer` varchar(191),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `holder_registry_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketplace_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`username` varchar(100) NOT NULL,
	`passwordHash` varchar(255),
	`isActive` boolean NOT NULL DEFAULT false,
	`isApproved` boolean NOT NULL DEFAULT false,
	`walletAddress` varchar(42),
	`hasTokenAccess` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastLogin` timestamp,
	CONSTRAINT `marketplace_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketplace_users_email_unique` UNIQUE(`email`),
	CONSTRAINT `marketplace_users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `oasis_buildings` (
	`id` varchar(80) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('house','apartment','storefront','warehouse','office') NOT NULL,
	`description` text,
	`data` text NOT NULL,
	`thumbnail` text,
	`version` int NOT NULL DEFAULT 1,
	`isPublic` boolean NOT NULL DEFAULT false,
	`tags` text NOT NULL DEFAULT '[]',
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oasis_buildings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oasis_element_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oasis_element_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oasis_world_elements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`name` varchar(150) NOT NULL,
	`slug` varchar(180),
	`description` text,
	`assetUri` text NOT NULL,
	`previewImageUri` text,
	`creatorWallet` varchar(140),
	`payoutSplits` text,
	`acceptedCurrencies` text,
	`price` decimal(18,6) NOT NULL DEFAULT '0',
	`currency` enum('TROO','TROO_POO','XRP','SOL','POL','BTC','ETH','BNB','USDC') NOT NULL DEFAULT 'TROO',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oasis_world_elements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `security_certificates` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`offeringId` varchar(36) NOT NULL,
	`certificateNo` varchar(64) NOT NULL,
	`holderId` varchar(36) NOT NULL,
	`holderName` varchar(255) NOT NULL,
	`amount` varchar(64) NOT NULL,
	`custodyMode` enum('holder_possession','trustee_or_custodian_possession') NOT NULL,
	`custodianName` varchar(255),
	`possessionAcknowledgedAt` timestamp,
	`possessionAcknowledgedMethod` varchar(80),
	`executedDocumentId` varchar(36),
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`status` enum('issued','voided','replaced') NOT NULL DEFAULT 'issued',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `security_certificates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `security_events` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`offeringId` varchar(36),
	`certificateId` varchar(36),
	`eventType` enum('CERT_ISSUED','POSSESSION_ACKNOWLEDGED','CUSTODY_CHANGED','TRANSFER_REQUESTED','TRANSFER_APPROVED','TRANSFER_REJECTED','CERT_REPLACEMENT_REQUESTED','CERT_REPLACED') NOT NULL,
	`actorUserId` int,
	`actorRole` varchar(40),
	`payloadJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `security_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `security_holders` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`displayName` varchar(255) NOT NULL,
	`holderRef` varchar(191),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `security_holders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `security_offerings` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`status` enum('draft','finalized','cancelled','error') NOT NULL DEFAULT 'draft',
	`offeringName` varchar(255) NOT NULL,
	`securityType` enum('debt','participation','equity_like') NOT NULL,
	`exemptionTag` varchar(40) NOT NULL,
	`counselApproved` boolean NOT NULL DEFAULT false,
	`draftJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `security_offerings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `security_transfer_approvals` (
	`id` varchar(36) NOT NULL,
	`transferRequestId` varchar(36) NOT NULL,
	`roleRequired` varchar(40) NOT NULL,
	`approvedByUserId` int,
	`approvedAt` timestamp,
	`signatureJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `security_transfer_approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `security_transfer_requests` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`offeringId` varchar(36) NOT NULL,
	`certificateId` varchar(36) NOT NULL,
	`fromHolderId` varchar(36) NOT NULL,
	`toHolderId` varchar(36) NOT NULL,
	`reason` text,
	`effectiveDate` varchar(32),
	`status` enum('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `security_transfer_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transfer_requests` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`securityCertificateId` varchar(36) NOT NULL,
	`fromHolderName` varchar(255),
	`toHolderName` varchar(255) NOT NULL,
	`status` enum('pending','approved','denied') NOT NULL DEFAULT 'pending',
	`approvalsJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transfer_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_assets` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`assetType` varchar(80) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_beneficiaries` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`relationship` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_beneficiaries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_bondholder_register` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`debtInstrumentId` varchar(36) NOT NULL,
	`holderName` varchar(200) NOT NULL,
	`holderEntityType` varchar(80),
	`holderContact` text,
	`principalHeld` decimal(18,6) NOT NULL,
	`issueDate` date NOT NULL,
	`registerEntryStatus` enum('active','redeemed','cancelled') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_bondholder_register_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_controls` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`securitiesEnabled` boolean NOT NULL DEFAULT false,
	`requireCounselApproval` boolean NOT NULL DEFAULT true,
	`requireTrusteeApproval` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_controls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_debt_authority_checks` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`debtInstrumentId` varchar(36) NOT NULL,
	`borrowingAuthorized` boolean NOT NULL DEFAULT false,
	`debtIssuanceAuthorized` boolean NOT NULL DEFAULT false,
	`pledgeAuthorized` boolean NOT NULL DEFAULT false,
	`delegationAuthorized` boolean NOT NULL DEFAULT false,
	`instrumentCitations` text,
	`notes` text,
	`passed` boolean NOT NULL DEFAULT false,
	`checkedByUserId` varchar(36),
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_debt_authority_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_debt_collateral` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`debtInstrumentId` varchar(36) NOT NULL,
	`collateralType` enum('none','ucc_personal_property','real_property','revenue_assignment','cash_collateral','other') NOT NULL,
	`description` text,
	`uccFilingNumber` varchar(120),
	`recordingOffice` varchar(200),
	`recordingReference` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_debt_collateral_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_debt_disclosures` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`debtInstrumentId` varchar(36) NOT NULL,
	`disclosureDocType` enum('ppm','subscription_agreement','risk_factors','conflicts','term_sheet','other') NOT NULL,
	`title` varchar(200),
	`description` text,
	`documentId` varchar(36),
	`isRequired` boolean NOT NULL DEFAULT true,
	`isComplete` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_debt_disclosures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_debt_instruments` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`instrumentStatus` enum('draft','authority_failed','authority_passed','resolution_adopted','offering_configured','issued','closed','voided') NOT NULL DEFAULT 'draft',
	`debtInstrumentType` enum('private_placement','secured_trust','revenue') NOT NULL,
	`securitiesExemption` enum('reg_d_506b','reg_d_506c') NOT NULL,
	`principalAmount` decimal(18,6) NOT NULL,
	`interestRate` decimal(5,4),
	`paymentFrequencyMonths` int,
	`maturityDate` date NOT NULL,
	`governingLaw` varchar(100),
	`isNonRecourse` boolean NOT NULL DEFAULT false,
	`revenueSourceDescription` text,
	`trusteeResolutionId` varchar(36),
	`bondInstrumentDocumentId` varchar(36),
	`trusteeName` varchar(200),
	`trustName` varchar(200),
	`trustDateLabel` varchar(80),
	`advertisingAllowed` boolean NOT NULL DEFAULT false,
	`accreditedOnly` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_debt_instruments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_documents` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`docType` varchar(80) NOT NULL,
	`title` varchar(255) NOT NULL,
	`version` int NOT NULL,
	`classification` enum('public','demandable','private') NOT NULL DEFAULT 'private',
	`disclosureState` enum('not_shared','shared','shared_with_conditions','revoked') NOT NULL DEFAULT 'not_shared',
	`proofState` enum('not_hashed','hashed','archived','anchored') NOT NULL DEFAULT 'not_hashed',
	`contentJson` text,
	`canonicalHashSha256` varchar(128),
	`archiveId` varchar(191),
	`anchorTx` varchar(191),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trust_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_drafts` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`draftType` varchar(80) NOT NULL,
	`schemaVersion` int NOT NULL,
	`version` int NOT NULL,
	`payloadJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trust_drafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_parties` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`role` enum('grantor','trustee') NOT NULL,
	`displayName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_parties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_record_roles` (
	`userId` int NOT NULL,
	`role` enum('Manager','Trustee') NOT NULL DEFAULT 'Manager',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_record_roles_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `trust_record_states` (
	`userId` int NOT NULL,
	`stateJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_record_states_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `trust_resolutions` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`resolutionType` enum('bond_issuance','security_offer','amendment','other') NOT NULL,
	`title` varchar(200),
	`purpose` text,
	`authorityBasis` text,
	`principalAmount` decimal(18,6),
	`interestRate` decimal(5,4),
	`maturityDate` date,
	`securitiesExemption` enum('reg_d_506b','reg_d_506c'),
	`executionDate` timestamp,
	`adoptedByUserId` varchar(36),
	`adoptedByName` varchar(200),
	`documentId` varchar(36),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_resolutions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trusts` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`status` enum('draft','finalized','signed','recorded','error') NOT NULL DEFAULT 'draft',
	`source` varchar(40),
	`clientId` varchar(36),
	`publicId` varchar(40),
	`publicIdIssuedAt` timestamp,
	`name` varchar(255),
	`trustType` enum('revocable_living_trust','irrevocable_trust','testamentary_trust','special_purpose_trust'),
	`trustMode` enum('standard','private_safe') NOT NULL DEFAULT 'standard',
	`jurisdictionState` varchar(10),
	`situsState` varchar(10),
	`governingLawState` varchar(10),
	`executedAt` timestamp,
	`workspaceStatus` enum('draft','in_review','approved','executed') DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trusts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_asset_certificates` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`assetId` varchar(36) NOT NULL,
	`certificateNumber` varchar(80) NOT NULL,
	`certificateClass` varchar(80) DEFAULT 'Unit',
	`units` int DEFAULT 1,
	`restrictionsJson` text,
	`trustDocumentId` varchar(36),
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `workflow_asset_certificates_id` PRIMARY KEY(`id`),
	CONSTRAINT `workflow_asset_certificates_certificateNumber_unique` UNIQUE(`certificateNumber`)
);
--> statement-breakpoint
CREATE TABLE `workflow_client_profiles` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`publicId` varchar(32) NOT NULL,
	`fullName` varchar(255),
	`email` varchar(255),
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_client_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `workflow_client_profiles_publicId_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
CREATE TABLE `workflow_presentation_packages` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`packageNumber` varchar(80) NOT NULL,
	`status` enum('draft','ready_for_review','approved','archived') DEFAULT 'draft',
	`includedJson` text NOT NULL,
	`pitchDeckTrustDocumentId` varchar(36),
	`offeringId` varchar(36),
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_presentation_packages_id` PRIMARY KEY(`id`),
	CONSTRAINT `workflow_presentation_packages_packageNumber_unique` UNIQUE(`packageNumber`)
);
--> statement-breakpoint
CREATE TABLE `workflow_promissory_notes` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`certificateId` varchar(36) NOT NULL,
	`noteNumber` varchar(80) NOT NULL,
	`issuerName` varchar(255) NOT NULL,
	`principalAmountCents` int NOT NULL,
	`interestRateBps` int,
	`paymentTerms` text NOT NULL,
	`maturityDate` varchar(24) NOT NULL,
	`governingLawState` varchar(10),
	`trustDocumentId` varchar(36),
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `workflow_promissory_notes_id` PRIMARY KEY(`id`),
	CONSTRAINT `workflow_promissory_notes_noteNumber_unique` UNIQUE(`noteNumber`)
);
--> statement-breakpoint
CREATE TABLE `workflow_security_agreements` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`certificateId` varchar(36) NOT NULL,
	`noteId` varchar(36),
	`agreementNumber` varchar(80) NOT NULL,
	`debtorName` varchar(255) NOT NULL,
	`collateralDescription` text NOT NULL,
	`governingLawState` varchar(10),
	`trustDocumentId` varchar(36),
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `workflow_security_agreements_id` PRIMARY KEY(`id`),
	CONSTRAINT `workflow_security_agreements_agreementNumber_unique` UNIQUE(`agreementNumber`)
);
--> statement-breakpoint
CREATE TABLE `workflow_sequences` (
	`id` varchar(36) NOT NULL,
	`scope` varchar(191) NOT NULL,
	`currentValue` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_sequences_id` PRIMARY KEY(`id`),
	CONSTRAINT `workflow_sequences_scope_unique` UNIQUE(`scope`)
);
--> statement-breakpoint
CREATE TABLE `workflow_trust_assets` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`type` varchar(40) NOT NULL,
	`name` varchar(255) NOT NULL,
	`identifier` varchar(191),
	`valuationUSD` int,
	`valuationAsOf` varchar(24),
	`encumbrances` text,
	`evidenceNotes` text,
	`status` enum('recorded','certificated','pledged','archived') DEFAULT 'recorded',
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_trust_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `clients` ADD CONSTRAINT `clients_userId_marketplace_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `marketplace_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_bondholder_register_instrument` ON `trust_bondholder_register` (`debtInstrumentId`);--> statement-breakpoint
CREATE INDEX `idx_bondholder_register_trust` ON `trust_bondholder_register` (`trustId`);--> statement-breakpoint
CREATE INDEX `idx_debt_authority_checks_instrument` ON `trust_debt_authority_checks` (`debtInstrumentId`);--> statement-breakpoint
CREATE INDEX `idx_debt_authority_checks_trust` ON `trust_debt_authority_checks` (`trustId`);--> statement-breakpoint
CREATE INDEX `idx_debt_collateral_instrument` ON `trust_debt_collateral` (`debtInstrumentId`);--> statement-breakpoint
CREATE INDEX `idx_debt_disclosures_instrument` ON `trust_debt_disclosures` (`debtInstrumentId`);--> statement-breakpoint
CREATE INDEX `idx_trust_debt_instruments_trustId` ON `trust_debt_instruments` (`trustId`);--> statement-breakpoint
CREATE INDEX `idx_trust_debt_instruments_status` ON `trust_debt_instruments` (`instrumentStatus`);--> statement-breakpoint
CREATE INDEX `idx_trust_resolutions_trustId` ON `trust_resolutions` (`trustId`);