CREATE TABLE `agent_actions` (
	`id` varchar(36) NOT NULL,
	`sessionId` varchar(36) NOT NULL,
	`proposalJson` json NOT NULL,
	`appliedPatchJson` json,
	`acceptedByUserId` int,
	`bindingKey` varchar(80),
	`bindingPath` varchar(200),
	`schemaVersion` varchar(20),
	`beforeHash` varchar(64),
	`afterHash` varchar(64),
	`patchHash` varchar(64),
	`noOp` boolean NOT NULL DEFAULT false,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_sessions` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36),
	`moduleType` varchar(80) NOT NULL,
	`status` enum('active','closed') NOT NULL DEFAULT 'active',
	`createdByUserId` int NOT NULL,
	`messages` json DEFAULT (JSON_ARRAY()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_agent_collaborators` (
	`id` varchar(36) NOT NULL,
	`agentId` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`invitedByUserId` int NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'accepted',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_agent_collaborators_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_agent_collaborators_agent_user_uidx` UNIQUE(`agentId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `ai_agent_knowledge_items` (
	`id` varchar(36) NOT NULL,
	`agentId` varchar(36) NOT NULL,
	`type` varchar(32) NOT NULL,
	`contentOrPointer` text NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_agent_knowledge_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_agent_site_bindings` (
	`id` varchar(36) NOT NULL,
	`agentId` varchar(36) NOT NULL,
	`siteId` varchar(36) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`widgetKey` varchar(48) NOT NULL,
	`allowedDomains` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_agent_site_bindings_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_agent_site_bindings_widget_key_uidx` UNIQUE(`widgetKey`)
);
--> statement-breakpoint
CREATE TABLE `ai_agents` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`workspaceId` varchar(64),
	`consultantId` varchar(36),
	`name` varchar(120) NOT NULL,
	`description` varchar(255),
	`systemPrompt` text,
	`model` varchar(64),
	`temperature` decimal(4,2),
	`toolsJson` text,
	`voiceProvider` varchar(32),
	`voiceId` varchar(64),
	`llmEndpoint` varchar(512),
	`llmApiKeyEnc` text,
	`status` varchar(32) NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_voices` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`provider` varchar(32) NOT NULL,
	`providerVoiceId` varchar(64) NOT NULL,
	`isCustom` boolean NOT NULL DEFAULT true,
	`status` varchar(32) NOT NULL DEFAULT 'active',
	`consent` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_voices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` varchar(36) NOT NULL,
	`targetType` enum('minutes','resolution') NOT NULL,
	`targetId` varchar(36) NOT NULL,
	`requiredRole` enum('Trustee','Manager','Director','Officer','Member','LeadTrustee','ManagingMember','Chair','Secretary') NOT NULL,
	`approverId` int,
	`approverName` varchar(255),
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`approvedAt` timestamp,
	`signatureHash` varchar(64),
	CONSTRAINT `approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_nonces` (
	`walletAddress` varchar(42) NOT NULL,
	`nonce` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_nonces_walletAddress` PRIMARY KEY(`walletAddress`)
);
--> statement-breakpoint
CREATE TABLE `campaign_assets` (
	`id` varchar(36) NOT NULL,
	`campaign_id` varchar(36) NOT NULL,
	`creative_type` varchar(24) NOT NULL,
	`storage_url` varchar(512),
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaign_audit_events` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`post_id` varchar(36),
	`action` varchar(80) NOT NULL,
	`platform` varchar(24),
	`details` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaign_posts` (
	`id` varchar(36) NOT NULL,
	`campaign_id` varchar(36) NOT NULL,
	`asset_id` varchar(36),
	`platform` varchar(24) NOT NULL,
	`scheduled_at` timestamp,
	`status` varchar(24) NOT NULL DEFAULT 'DRAFT',
	`caption` text,
	`hashtags` varchar(1000),
	`link_url` varchar(512),
	`utm_params` json,
	`platform_post_id` varchar(120),
	`error_message` text,
	`posted_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaign_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`client_id` varchar(36) NOT NULL DEFAULT '',
	`name` varchar(200) NOT NULL,
	`objective` varchar(200),
	`status` varchar(24) NOT NULL DEFAULT 'DRAFT',
	`start_at` timestamp,
	`end_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cluster_symbols` (
	`id` varchar(36) NOT NULL,
	`clusterId` varchar(36) NOT NULL,
	`symbol` varchar(10) NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cluster_symbols_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consultant_notes` (
	`id` varchar(36) NOT NULL,
	`consultantId` varchar(36) NOT NULL,
	`symbol` varchar(10) NOT NULL,
	`timeframe` varchar(5) NOT NULL,
	`notes` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultant_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consultant_watchlists` (
	`id` varchar(36) NOT NULL,
	`consultantId` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultant_watchlists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_call_logs` (
	`id` varchar(36) NOT NULL,
	`conversationId` varchar(36),
	`contactId` varchar(36),
	`userId` int,
	`voiceAgentId` varchar(36),
	`fromNumber` varchar(50) NOT NULL,
	`toNumber` varchar(50) NOT NULL,
	`direction` varchar(16) NOT NULL,
	`status` varchar(50),
	`duration` int,
	`recordingUrl` text,
	`transcript` text,
	`twilioCallSid` varchar(100),
	`metadata` json,
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	CONSTRAINT `crm_call_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_contacts` (
	`id` varchar(36) NOT NULL,
	`workspaceId` varchar(36),
	`userId` int,
	`email` varchar(320),
	`firstName` varchar(100),
	`lastName` varchar(100),
	`phone` varchar(50),
	`company` varchar(255),
	`leadSource` varchar(100),
	`tags` text,
	`customFields` json,
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	CONSTRAINT `crm_contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_conversations` (
	`id` varchar(36) NOT NULL,
	`contactId` varchar(36),
	`userId` int,
	`workspaceId` varchar(36),
	`channel` varchar(32) NOT NULL,
	`status` varchar(50),
	`subject` varchar(255),
	`lastMessageAt` datetime,
	`lastMessagePreview` varchar(255),
	`unreadCount` int NOT NULL DEFAULT 0,
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	CONSTRAINT `crm_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_messages` (
	`id` varchar(36) NOT NULL,
	`conversationId` varchar(36) NOT NULL,
	`direction` varchar(16) NOT NULL,
	`channel` varchar(32) NOT NULL,
	`content` text,
	`subject` varchar(255),
	`callLogId` varchar(36),
	`status` varchar(32),
	`metadata` json,
	`createdAt` datetime NOT NULL,
	CONSTRAINT `crm_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_tasks` (
	`id` varchar(36) NOT NULL,
	`contactId` varchar(36),
	`userId` int,
	`workspaceId` varchar(36),
	`title` varchar(255) NOT NULL,
	`description` text,
	`dueAt` datetime,
	`status` varchar(32),
	`priority` varchar(32),
	`source` varchar(32),
	`metadata` json,
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	CONSTRAINT `crm_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crypto_bubble_settings` (
	`id` varchar(36) NOT NULL,
	`currency` varchar(50) NOT NULL,
	`symbol` varchar(10) NOT NULL,
	`name` varchar(100) NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`displayOrder` int DEFAULT 0,
	`color` varchar(7),
	`icon` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crypto_bubble_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `crypto_bubble_settings_currency_idx` UNIQUE(`currency`)
);
--> statement-breakpoint
CREATE TABLE `crypto_transactions` (
	`id` varchar(36) NOT NULL,
	`transactionId` varchar(255) NOT NULL,
	`userAddress` varchar(255) NOT NULL,
	`transactionType` enum('deposit','withdraw','exchange','transfer','fee') NOT NULL,
	`currency` varchar(50) NOT NULL,
	`amount` decimal(20,8) NOT NULL,
	`fee` decimal(20,8) DEFAULT '0.00',
	`status` enum('pending','completed','declined','cancelled') DEFAULT 'pending',
	`txHash` varchar(255),
	`fromAddress` varchar(255),
	`toAddress` varchar(255),
	`chain` varchar(50),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crypto_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `crypto_transactions_transactionId_idx` UNIQUE(`transactionId`)
);
--> statement-breakpoint
CREATE TABLE `currency_prices` (
	`id` varchar(36) NOT NULL,
	`currency` varchar(50) NOT NULL,
	`priceUSD` decimal(20,8) NOT NULL,
	`priceChange24h` decimal(10,4),
	`volume24h` decimal(20,8),
	`marketCap` decimal(20,2),
	`lastUpdated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `currency_prices_id` PRIMARY KEY(`id`),
	CONSTRAINT `currency_prices_unique_currency` UNIQUE(`currency`)
);
--> statement-breakpoint
CREATE TABLE `deed_executions` (
	`id` varchar(36) NOT NULL,
	`method` enum('WET_IN_PERSON','ESIGN','RON') NOT NULL DEFAULT 'WET_IN_PERSON',
	`signDate` timestamp,
	`notarized` boolean NOT NULL DEFAULT false,
	`witnessesRequired` boolean NOT NULL DEFAULT false,
	`witnessesCount` int NOT NULL DEFAULT 0,
	`notaryName` varchar(255),
	`notaryCommission` varchar(100),
	`notaryState` varchar(50),
	`acknowledgementText` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deed_executions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deed_parties` (
	`id` varchar(36) NOT NULL,
	`deedId` varchar(36) NOT NULL,
	`role` enum('GRANTOR','GRANTEE','PREPARER','NOTARY','WITNESS') NOT NULL,
	`personId` varchar(36),
	`displayName` varchar(255) NOT NULL,
	`address` varchar(500),
	`capacityLine` varchar(255),
	`email` varchar(255),
	`phone` varchar(50),
	CONSTRAINT `deed_parties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deed_properties` (
	`id` varchar(36) NOT NULL,
	`street1` varchar(255),
	`street2` varchar(255),
	`city` varchar(100),
	`state` varchar(50),
	`postalCode` varchar(20),
	`county` varchar(100),
	`parcelNumber` varchar(100),
	`legalDescription` text,
	`situsJurisdiction` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deed_properties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deed_recordings` (
	`id` varchar(36) NOT NULL,
	`status` enum('NOT_SUBMITTED','SUBMITTED','RECORDED','REJECTED') NOT NULL DEFAULT 'NOT_SUBMITTED',
	`county` varchar(100),
	`state` varchar(50),
	`submittedAt` timestamp,
	`recordedAt` timestamp,
	`instrumentNumber` varchar(100),
	`book` varchar(50),
	`page` varchar(50),
	`rejectionReason` text,
	`recordingReceiptExhibitId` varchar(36),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deed_recordings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deeds` (
	`id` varchar(36) NOT NULL,
	`clientId` varchar(36) NOT NULL,
	`trustId` varchar(36),
	`entityId` varchar(36),
	`deedType` enum('QUITCLAIM','WARRANTY_GENERAL','WARRANTY_SPECIAL','GRANT','TRUST_TRANSFER','OTHER') NOT NULL,
	`status` enum('draft','pending','approved','executed','recorded','void') NOT NULL DEFAULT 'draft',
	`approvingResolutionId` varchar(36),
	`approvingMinutesId` varchar(36),
	`propertyId` varchar(36),
	`executionId` varchar(36),
	`recordingId` varchar(36),
	`draftPdfExhibitId` varchar(36),
	`executedPdfExhibitId` varchar(36),
	`finalHash` varchar(64),
	`lockedAt` timestamp,
	`instrumentId` varchar(36),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deeds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entity_maps` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`nodesJson` text NOT NULL,
	`edgesJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `entity_maps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exchange_transactions` (
	`id` varchar(36) NOT NULL,
	`userAddress` varchar(255) NOT NULL,
	`fromCurrency` varchar(50) NOT NULL,
	`toCurrency` varchar(50) NOT NULL,
	`fromAmount` decimal(20,8) NOT NULL,
	`toAmount` decimal(20,8) NOT NULL,
	`exchangeRate` decimal(20,8) NOT NULL,
	`fee` decimal(20,8) DEFAULT '0.00',
	`status` enum('pending','completed','failed','cancelled') DEFAULT 'pending',
	`transactionId` varchar(255),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `exchange_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exhibits` (
	`id` varchar(36) NOT NULL,
	`minutesId` varchar(36),
	`resolutionId` varchar(36),
	`fileName` varchar(255) NOT NULL,
	`fileType` varchar(100) NOT NULL,
	`storagePath` varchar(500) NOT NULL,
	`hash` varchar(64) NOT NULL,
	`uploadedBy` int NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exhibits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generated_documents` (
	`id` varchar(36) NOT NULL,
	`sessionId` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`storageKey` varchar(500) NOT NULL,
	`sha256` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generated_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `grant_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`walletAddress` varchar(42),
	`title` varchar(255) NOT NULL,
	`funderName` varchar(255),
	`deadline` date,
	`amountRequested` varchar(64),
	`status` enum('draft','submitted','awarded','declined') NOT NULL DEFAULT 'draft',
	`legalStatus` text,
	`taxId` varchar(64),
	`governingDocs` text,
	`complianceCerts` text,
	`insuranceCoverage` text,
	`orgLegalName` varchar(255),
	`orgContactInfo` text,
	`orgEntityType` varchar(100),
	`missionStatement` text,
	`visionStatement` text,
	`geographicAreas` text,
	`projectSummary` text,
	`primaryGoals` text,
	`specificFundingNeeds` text,
	`needsStatement` text,
	`supportingEvidence` text,
	`currentEfforts` text,
	`stakeholders` text,
	`alignmentStatement` text,
	`alignmentSupportingDocs` text,
	`staffExpertise` text,
	`pastSuccesses` text,
	`financialStability` text,
	`resources` text,
	`partnerships` text,
	`sustainabilityPlan` text,
	`longTermImpact` text,
	`replicationScalability` text,
	`narrative` text,
	`budget` text,
	`matchingFunds` text,
	`fundingSources` text,
	`costJustification` text,
	`evaluationMetrics` text,
	`monitoringPlan` text,
	`dataCollectionMethods` text,
	`reportingSchedule` text,
	`projectLeader` text,
	`financialContact` text,
	`authorizedSignatories` text,
	`goals` text,
	`methodology` text,
	`timeline` text,
	`otherRelevantDocs` text,
	`flexibilityModifications` text,
	`referralSources` text,
	`ethicalAcknowledgment` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `grant_applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `industry_benchmarks` (
	`id` varchar(36) NOT NULL,
	`industry` varchar(120) NOT NULL,
	`metric` varchar(120) NOT NULL,
	`value` decimal(18,4) NOT NULL,
	`unit` varchar(32) NOT NULL,
	`source_name` varchar(160) NOT NULL,
	`citation_url` varchar(500) NOT NULL,
	`year` int NOT NULL,
	`confidence` varchar(24),
	`captured_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `industry_benchmarks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `instruments` (
	`id` varchar(36) NOT NULL,
	`trustId` varchar(36),
	`entityId` varchar(36),
	`instrumentType` enum('DEED','RESOLUTION','LIEN','ASSIGNMENT','AWARD','FEE_SCHEDULE') NOT NULL,
	`status` enum('draft','authorized','executed','recorded','witnessed','settled') NOT NULL DEFAULT 'draft',
	`authorityResolutionId` varchar(36),
	`concreteId` varchar(36) NOT NULL,
	`concreteType` varchar(50) NOT NULL,
	`instrumentHash` varchar(64) NOT NULL,
	`executedAt` timestamp,
	`recordedAt` timestamp,
	`witnessedAt` timestamp,
	`settledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `instruments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `market_clusters` (
	`id` varchar(36) NOT NULL,
	`name` varchar(50) NOT NULL,
	`displayName` varchar(100) NOT NULL,
	`description` text,
	`color` varchar(7) NOT NULL DEFAULT '#6366f1',
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `market_clusters_id` PRIMARY KEY(`id`),
	CONSTRAINT `market_clusters_name_unique` UNIQUE(`name`),
	CONSTRAINT `market_clusters_name_idx` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `merch_assets` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`type` enum('GARMENT_TEMPLATE','LOGO','REFERENCE','BRAND_KIT','MASK') NOT NULL,
	`name` varchar(191) NOT NULL,
	`url` text NOT NULL,
	`metadataJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `merch_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `merch_exports` (
	`id` varchar(36) NOT NULL,
	`projectId` varchar(36) NOT NULL,
	`type` enum('MOCKUP_PACK_ZIP','TECHPACK_PDF') NOT NULL,
	`url` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `merch_exports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `merch_jobs` (
	`id` varchar(36) NOT NULL,
	`type` enum('RENDER','INPAINT','EXPORT_ZIP','EXPORT_PDF') NOT NULL,
	`status` enum('QUEUED','RUNNING','SUCCEEDED','FAILED') NOT NULL DEFAULT 'QUEUED',
	`inputJson` json,
	`outputJson` json,
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `merch_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `merch_orders` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`projectId` varchar(36) NOT NULL,
	`status` enum('DRAFT','PAID','FULFILLING','SHIPPED','CANCELED') NOT NULL DEFAULT 'DRAFT',
	`itemsJson` json,
	`totalCents` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `merch_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `merch_projects` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`lane` enum('CREATE','STUDIO') NOT NULL DEFAULT 'CREATE',
	`name` varchar(191) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `merch_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `merch_renders` (
	`id` varchar(36) NOT NULL,
	`versionId` varchar(36) NOT NULL,
	`kind` enum('MOCKUP_FRONT','MOCKUP_BACK','FLAT','LIFESTYLE') NOT NULL,
	`width` int NOT NULL,
	`height` int NOT NULL,
	`url` text NOT NULL,
	`metadataJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `merch_renders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `merch_versions` (
	`id` varchar(36) NOT NULL,
	`projectId` varchar(36) NOT NULL,
	`kind` enum('GENERATE','INPAINT','VARIANT') NOT NULL DEFAULT 'GENERATE',
	`prompt` text,
	`negativePrompt` text,
	`seed` int,
	`modelVersion` varchar(120),
	`paramsJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `merch_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `minute_books` (
	`id` varchar(36) NOT NULL,
	`clientId` varchar(36) NOT NULL,
	`entityId` varchar(36),
	`trustId` varchar(36),
	`entityType` enum('Trust','LLC','C-Corp','Foundation','Partnership','Other') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int NOT NULL,
	`retentionPolicy` varchar(100),
	CONSTRAINT `minute_books_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `minute_participants` (
	`id` varchar(36) NOT NULL,
	`minutesId` varchar(36) NOT NULL,
	`personId` varchar(36),
	`personName` varchar(255) NOT NULL,
	`role` enum('Trustee','Manager','Director','Officer','Member','Consultant','Other') NOT NULL,
	`present` boolean NOT NULL DEFAULT true,
	`votingPower` decimal(10,2) NOT NULL DEFAULT '1.00',
	CONSTRAINT `minute_participants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `minutes` (
	`id` varchar(36) NOT NULL,
	`minuteBookId` varchar(36) NOT NULL,
	`recordType` enum('meeting','written_consent') NOT NULL,
	`title` varchar(255) NOT NULL,
	`actionDate` date NOT NULL,
	`actionTime` varchar(10),
	`location` varchar(500),
	`calledBy` varchar(255),
	`chair` varchar(255),
	`quorumRequired` boolean NOT NULL DEFAULT true,
	`quorumMet` boolean NOT NULL DEFAULT false,
	`agenda` text,
	`status` enum('draft','pending','approved','locked') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int NOT NULL,
	`submittedAt` timestamp,
	`approvedAt` timestamp,
	`finalizedAt` timestamp,
	`hash` varchar(64),
	CONSTRAINT `minutes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`trustId` varchar(36),
	`name` varchar(255) NOT NULL,
	`planKind` varchar(32) NOT NULL,
	`planVersion` int NOT NULL,
	`planJson` text NOT NULL,
	`planHash` varchar(64),
	`prompt` text,
	`seed` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `model_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nft_activity` (
	`id` varchar(36) NOT NULL,
	`nftId` varchar(36) NOT NULL,
	`activityType` enum('mint','list','sale','transfer','cancel') NOT NULL,
	`fromAddress` varchar(255),
	`toAddress` varchar(255),
	`price` decimal(20,8),
	`currency` varchar(10),
	`txHash` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `nft_activity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nft_collections` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`description` text,
	`imageUrl` text,
	`chain` enum('xrpl','solana','ethereum','polygon','metallicus') NOT NULL,
	`contractAddress` varchar(255),
	`creatorAddress` varchar(255) NOT NULL,
	`royaltyPercentage` decimal(5,2) NOT NULL DEFAULT '0',
	`isPublic` boolean NOT NULL DEFAULT false,
	`isVerified` boolean NOT NULL DEFAULT false,
	`totalSupply` int NOT NULL DEFAULT 0,
	`floorPrice` decimal(20,8),
	`volumeTraded` decimal(30,8) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nft_collections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nft_listings` (
	`id` varchar(36) NOT NULL,
	`nftId` varchar(36) NOT NULL,
	`sellerAddress` varchar(255) NOT NULL,
	`price` decimal(20,8) NOT NULL,
	`currency` varchar(10) NOT NULL,
	`listingType` enum('fixed','auction') NOT NULL DEFAULT 'fixed',
	`auctionEndTime` timestamp,
	`highestBid` decimal(20,8),
	`highestBidder` varchar(255),
	`status` enum('active','sold','cancelled','expired') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`soldAt` timestamp,
	CONSTRAINT `nft_listings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nft_sales` (
	`id` varchar(36) NOT NULL,
	`nftId` varchar(36) NOT NULL,
	`listingId` varchar(36),
	`sellerAddress` varchar(255) NOT NULL,
	`buyerAddress` varchar(255) NOT NULL,
	`price` decimal(20,8) NOT NULL,
	`currency` varchar(10) NOT NULL,
	`royaltyAmount` decimal(20,8) NOT NULL DEFAULT '0',
	`platformFee` decimal(20,8) NOT NULL DEFAULT '0',
	`txHash` varchar(255),
	`soldAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `nft_sales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nfts` (
	`id` varchar(36) NOT NULL,
	`tokenId` varchar(255) NOT NULL,
	`chain` enum('xrpl','solana','ethereum','polygon','metallicus') NOT NULL,
	`contractAddress` varchar(255),
	`ownerAddress` varchar(255) NOT NULL,
	`creatorAddress` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`imageUrl` text NOT NULL,
	`metadataUrl` text,
	`attributes` text,
	`collectionId` varchar(36),
	`isListed` boolean NOT NULL DEFAULT false,
	`listPrice` decimal(20,8),
	`listCurrency` varchar(10),
	`royaltyPercentage` decimal(5,2) NOT NULL DEFAULT '0',
	`isStaked` boolean NOT NULL DEFAULT false,
	`mintedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nfts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oasis_asset_packs` (
	`id` varchar(64) NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`summary` text,
	`description` text,
	`engine` enum('unity','unreal','universal') NOT NULL DEFAULT 'universal',
	`previewImageUri` text,
	`packManifestUri` text,
	`includedElementIds` text,
	`tags` text,
	`isPublished` boolean NOT NULL DEFAULT false,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oasis_asset_packs_id` PRIMARY KEY(`id`),
	CONSTRAINT `oasis_asset_packs_slug_uidx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `oasis_events` (
	`id` varchar(80) NOT NULL,
	`spaceId` varchar(80) NOT NULL,
	`type` enum('SPACE_ACTIVATED') NOT NULL,
	`actorWallet` varchar(140),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `oasis_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oasis_market_licenses` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`itemType` enum('world','object','pack') NOT NULL,
	`itemRefId` varchar(64) NOT NULL,
	`purchaseId` varchar(64),
	`status` enum('active','revoked') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oasis_market_licenses_id` PRIMARY KEY(`id`),
	CONSTRAINT `oasis_market_licenses_user_item_uidx` UNIQUE(`userId`,`itemType`,`itemRefId`)
);
--> statement-breakpoint
CREATE TABLE `oasis_market_listings` (
	`id` varchar(64) NOT NULL,
	`itemType` enum('world','object','pack') NOT NULL,
	`itemRefId` varchar(64) NOT NULL,
	`title` varchar(180) NOT NULL,
	`subtitle` varchar(255),
	`description` text,
	`previewImageUri` text,
	`engine` enum('unity','unreal','webgl','custom','universal') NOT NULL DEFAULT 'universal',
	`price` decimal(18,6) NOT NULL DEFAULT '0',
	`currency` enum('TROO','TROO_POO','XRP','SOL','POL','BTC','ETH','BNB','USDC') NOT NULL DEFAULT 'TROO',
	`isPublished` boolean NOT NULL DEFAULT false,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oasis_market_listings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oasis_market_purchases` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`itemType` enum('world','object','pack') NOT NULL,
	`itemRefId` varchar(64) NOT NULL,
	`listingId` varchar(64),
	`txHash` varchar(140),
	`amount` decimal(18,6) NOT NULL DEFAULT '0',
	`currency` enum('TROO','TROO_POO','XRP','SOL','POL','BTC','ETH','BNB','USDC') NOT NULL DEFAULT 'TROO',
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `oasis_market_purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oasis_npc_knowledge` (
	`id` int AUTO_INCREMENT NOT NULL,
	`npcId` int NOT NULL,
	`topic` varchar(255) NOT NULL,
	`keywords` text NOT NULL,
	`content` text NOT NULL,
	`priority` int NOT NULL DEFAULT 5,
	`category` enum('world','business','product','navigation','general') NOT NULL DEFAULT 'general',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oasis_npc_knowledge_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oasis_npc_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`role` enum('user','npc') NOT NULL,
	`content` text NOT NULL,
	`intent` varchar(100),
	`intentConfidence` int,
	`sentiment` enum('positive','neutral','negative'),
	`responseSource` enum('rule','knowledge','llm'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `oasis_npc_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oasis_npc_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(128) NOT NULL,
	`npcId` int NOT NULL,
	`npcNpcId` varchar(128) NOT NULL,
	`userId` int,
	`currentTopic` varchar(255),
	`messageCount` int NOT NULL DEFAULT 0,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`lastActivity` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `oasis_npc_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `oasis_npc_sessions_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
CREATE TABLE `oasis_npcs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`npcId` varchar(128) NOT NULL,
	`name` varchar(100) NOT NULL,
	`role` enum('secretary','avatar','guide','voice_agent') NOT NULL,
	`title` varchar(200),
	`avatarEmoji` varchar(16) NOT NULL DEFAULT '🤖',
	`voiceStyle` enum('professional','friendly','authoritative','warm') DEFAULT 'friendly',
	`worldId` varchar(128),
	`ownerId` int,
	`greeting` text,
	`farewell` text,
	`personalityJson` text,
	`mood` enum('neutral','happy','busy','concerned','excited','formal') NOT NULL DEFAULT 'neutral',
	`isDefault` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oasis_npcs_id` PRIMARY KEY(`id`),
	CONSTRAINT `oasis_npcs_npcId_unique` UNIQUE(`npcId`)
);
--> statement-breakpoint
CREATE TABLE `oasis_placements` (
	`id` varchar(80) NOT NULL,
	`spaceId` varchar(80) NOT NULL,
	`kind` varchar(20),
	`elementId` int,
	`elementKey` varchar(120),
	`name` varchar(255),
	`modelUrl` text,
	`metadata` json,
	`x` decimal(12,4) NOT NULL,
	`y` decimal(12,4) NOT NULL,
	`z` decimal(12,4) NOT NULL,
	`ry` decimal(12,4) NOT NULL,
	`scale` decimal(12,4) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oasis_placements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oasis_spaces` (
	`id` varchar(80) NOT NULL,
	`status` enum('DRAFT','ACTIVE') NOT NULL DEFAULT 'DRAFT',
	`activatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oasis_spaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oasis_world_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`worldId` varchar(64) NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`payload` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `oasis_world_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oasis_world_versions` (
	`id` varchar(64) NOT NULL,
	`worldId` varchar(64) NOT NULL,
	`sceneGraph` text NOT NULL,
	`seed` int NOT NULL DEFAULT 0,
	`readinessHash` varchar(64),
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `oasis_world_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oasis_worlds` (
	`id` varchar(64) NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`summary` text,
	`description` text,
	`engine` enum('unity','unreal','webgl','custom') NOT NULL DEFAULT 'unity',
	`modelUri` text,
	`previewImageUri` text,
	`tags` text,
	`isPublished` boolean NOT NULL DEFAULT false,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oasis_worlds_id` PRIMARY KEY(`id`),
	CONSTRAINT `oasis_worlds_slug_uidx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `offer_assets` (
	`id` varchar(36) NOT NULL,
	`offerId` varchar(36) NOT NULL,
	`vslScript` text,
	`landingCopy` text,
	`adAngles` text,
	`emailSeq` text,
	`callScript` text,
	`version` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `offer_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`priceRange` varchar(64),
	`promise` text,
	`icp` text,
	`deliverables` text,
	`guarantee` text,
	`riskReversal` text,
	`positioning` text,
	`proof` text,
	`objections` text,
	`status` varchar(32) NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `offers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `public_witnesses` (
	`id` varchar(36) NOT NULL,
	`instrumentId` varchar(36) NOT NULL,
	`network` enum('ethereum','polygon','besu','other') NOT NULL,
	`txHash` varchar(191) NOT NULL,
	`blockNumber` int,
	`witnessHash` varchar(64) NOT NULL,
	`notarizedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `public_witnesses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `resolution_votes` (
	`id` varchar(36) NOT NULL,
	`resolutionId` varchar(36) NOT NULL,
	`personId` varchar(36) NOT NULL,
	`personName` varchar(255) NOT NULL,
	`vote` enum('for','against','abstain') NOT NULL,
	`votedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `resolution_votes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `resolutions` (
	`id` varchar(36) NOT NULL,
	`minutesId` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`resolutionType` enum('Organizational','Banking','AssetAcquisition','AssetSale','ContractApproval','TaxElection','OfficerAppointment','ManagerAppointment','DelegationOfAuthority','StandingResolution','Other') NOT NULL,
	`text` text NOT NULL,
	`effectiveDate` date NOT NULL,
	`expirationDate` date,
	`monetaryThreshold` decimal(18,2),
	`maxDollarThreshold` decimal(18,2),
	`requiresAnnualReaffirmation` boolean NOT NULL DEFAULT false,
	`lastReaffirmedAt` date,
	`counterparty` varchar(255),
	`approvalThreshold` enum('Majority','Supermajority','Unanimous') NOT NULL DEFAULT 'Majority',
	`isStanding` boolean NOT NULL DEFAULT false,
	`standingScope` text,
	`status` enum('draft','approved','rejected') NOT NULL DEFAULT 'draft',
	CONSTRAINT `resolutions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revenue_os_applications` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(64),
	`client_id` varchar(36),
	`trust_id` varchar(36),
	`walletAddress` varchar(64),
	`fullName` varchar(160) NOT NULL,
	`email` varchar(190) NOT NULL,
	`businessSummary` text NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'SUBMITTED',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `revenue_os_applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revenue_os_experiments` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`client_id` varchar(36) NOT NULL DEFAULT '',
	`trust_id` varchar(36) NOT NULL DEFAULT '',
	`name` varchar(200) NOT NULL,
	`lever` varchar(32) NOT NULL,
	`hypothesis` text,
	`status` varchar(24) NOT NULL DEFAULT 'ACTIVE',
	`input_snapshot` json,
	`result_snapshot` json,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`ended_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `revenue_os_experiments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revenue_os_monthly_snapshots` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`client_id` varchar(36) NOT NULL DEFAULT '',
	`trust_id` varchar(36) NOT NULL DEFAULT '',
	`month` varchar(7) NOT NULL,
	`traffic` int NOT NULL,
	`conversion_rate_pct` decimal(6,3) NOT NULL,
	`avg_order_value` decimal(18,2) NOT NULL,
	`revenue` decimal(18,2) NOT NULL,
	`cac` decimal(18,2) NOT NULL,
	`ltv` decimal(18,2) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `revenue_os_monthly_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `snap_user_workspace_month_uidx` UNIQUE(`user_id`,`client_id`,`trust_id`,`month`)
);
--> statement-breakpoint
CREATE TABLE `revenue_os_runs` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`client_id` varchar(36),
	`trust_id` varchar(36),
	`profileId` varchar(36) NOT NULL,
	`input` json NOT NULL,
	`output` json NOT NULL,
	`inputHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `revenue_os_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revenue_os_scenarios` (
	`id` varchar(36) NOT NULL,
	`payload` json NOT NULL,
	`created_by` varchar(128),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `revenue_os_scenarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revenue_os_workspace_apis` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`client_id` varchar(36) NOT NULL DEFAULT '',
	`trust_id` varchar(36) NOT NULL DEFAULT '',
	`provider` varchar(64) NOT NULL,
	`label` varchar(120),
	`api_key_enc` text,
	`endpoint_url` varchar(512),
	`cost_acknowledgment_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `revenue_os_workspace_apis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revenue_profiles` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`client_id` varchar(36),
	`trust_id` varchar(36),
	`walletAddress` varchar(64),
	`businessName` varchar(160),
	`businessType` varchar(120),
	`market` varchar(120),
	`currentMonthlyRevenue` decimal(18,2) NOT NULL,
	`targetMonthlyRevenue` decimal(18,2) NOT NULL,
	`avgOrderValue` decimal(18,2) NOT NULL,
	`grossMarginPct` decimal(5,2) NOT NULL,
	`monthlyTraffic` int NOT NULL,
	`conversionRatePct` decimal(6,3) NOT NULL,
	`cac` decimal(18,2) NOT NULL,
	`ltv` decimal(18,2) NOT NULL,
	`constraints` json,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `revenue_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `revprof_user_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `social_accounts` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`client_id` varchar(36) NOT NULL DEFAULT '',
	`platform` varchar(24) NOT NULL,
	`auth_type` varchar(24) NOT NULL DEFAULT 'OAUTH',
	`access_token_enc` text,
	`refresh_token_enc` text,
	`expires_at` timestamp,
	`external_account_id` varchar(120),
	`scopes` varchar(500),
	`display_name` varchar(200),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `social_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `socacc_user_platform_uidx` UNIQUE(`user_id`,`client_id`,`platform`)
);
--> statement-breakpoint
CREATE TABLE `trademark_projects` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`clientId` int,
	`workspaceId` varchar(128),
	`title` varchar(255) NOT NULL,
	`markType` enum('standard','special','sound') NOT NULL DEFAULT 'standard',
	`status` enum('draft','ready','review') NOT NULL DEFAULT 'draft',
	`payloadJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trademark_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_scene_plan_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trustId` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`planId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`notes` text,
	`metadataJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_scene_plan_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_wallets` (
	`id` varchar(36) NOT NULL,
	`userAddress` varchar(255) NOT NULL,
	`currency` varchar(50) NOT NULL,
	`balance` decimal(20,8) DEFAULT '0.00',
	`lockedBalance` decimal(20,8) DEFAULT '0.00',
	`walletAddress` varchar(255),
	`chain` varchar(50),
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_wallets_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_user_currency` UNIQUE(`userAddress`,`currency`)
);
--> statement-breakpoint
CREATE TABLE `wallet_activity_log` (
	`id` varchar(36) NOT NULL,
	`userAddress` varchar(255) NOT NULL,
	`activityType` enum('login','deposit','withdraw','exchange','transfer','balance_check') NOT NULL,
	`currency` varchar(50),
	`amount` decimal(20,8),
	`ipAddress` varchar(45),
	`userAgent` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wallet_activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `watchlist_symbols` (
	`id` varchar(36) NOT NULL,
	`watchlistId` varchar(36) NOT NULL,
	`symbol` varchar(10) NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `watchlist_symbols_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `web3_site_templates` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(191) NOT NULL,
	`description` text,
	`schemaJson` text NOT NULL,
	`trustId` varchar(36),
	`workspaceId` varchar(36),
	`clientId` varchar(36),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `web3_site_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `web3_site_versions` (
	`id` varchar(36) NOT NULL,
	`siteId` varchar(36) NOT NULL,
	`version` int NOT NULL,
	`schemaJson` text NOT NULL,
	`schemaHash` varchar(64) NOT NULL,
	`buildManifestJson` text,
	`ipfsCid` varchar(191),
	`previewImageCid` varchar(191),
	`glbScenePlanId` varchar(64),
	`createdByUserId` int NOT NULL,
	`createdByWallet` varchar(140),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `web3_site_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `web3_site_versions_site_version_uidx` UNIQUE(`siteId`,`version`)
);
--> statement-breakpoint
CREATE TABLE `web3_sites` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`trustId` varchar(36),
	`workspaceId` varchar(36),
	`name` varchar(255) NOT NULL,
	`slug` varchar(191),
	`status` enum('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
	`ownerWallet` varchar(140),
	`nftChainId` int,
	`nftContract` varchar(140),
	`nftTokenId` varchar(120),
	`currentVersionId` varchar(36),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `web3_sites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wizard_sessions` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`trustId` varchar(36),
	`kind` enum('IRREVOCABLE_TRUST') NOT NULL,
	`status` enum('DRAFT','REVIEW','LOCKED','GENERATED') NOT NULL DEFAULT 'DRAFT',
	`currentStep` varchar(50) NOT NULL DEFAULT 'state',
	`dataJson` text NOT NULL DEFAULT '{}',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wizard_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `trust_debt_instruments` MODIFY COLUMN `debtInstrumentType` enum('bond','private_placement','secured_trust','revenue') NOT NULL;--> statement-breakpoint
ALTER TABLE `trusts` MODIFY COLUMN `trustMode` enum('standard','private_safe','complex') NOT NULL DEFAULT 'standard';--> statement-breakpoint
ALTER TABLE `clients` ADD `title` varchar(80);--> statement-breakpoint
ALTER TABLE `marketplace_users` ADD `phone` varchar(24);--> statement-breakpoint
ALTER TABLE `marketplace_users` ADD `smsConsent` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `oasis_world_elements` ADD `manifestUri` text;--> statement-breakpoint
ALTER TABLE `oasis_world_elements` ADD `isEnterable` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `oasis_world_elements` ADD `hasDoor` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `oasis_world_elements` ADD `hasGlass` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `oasis_world_elements` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `oasis_world_elements` ADD `assetBounds` text;--> statement-breakpoint
ALTER TABLE `oasis_world_elements` ADD `defaultScale` decimal(8,4);--> statement-breakpoint
ALTER TABLE `oasis_world_elements` ADD `colliderType` varchar(24);--> statement-breakpoint
ALTER TABLE `oasis_world_elements` ADD `resolvedUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `oasis_world_elements` ADD `resolvedUrlUpdatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `oasis_world_elements` ADD `isReady` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `oasis_world_elements` ADD `lastVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `oasis_world_elements` ADD `lastError` varchar(512);--> statement-breakpoint
ALTER TABLE `trust_debt_instruments` ADD `bondNumber` varchar(80) NOT NULL;--> statement-breakpoint
ALTER TABLE `trust_debt_instruments` ADD `interestType` enum('fixed','variable') DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE `trust_debt_instruments` ADD `seniority` enum('senior','subordinated') DEFAULT 'senior' NOT NULL;--> statement-breakpoint
ALTER TABLE `trust_debt_instruments` ADD `callable` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `trust_debt_instruments` ADD `ppmDocumentId` varchar(36);--> statement-breakpoint
ALTER TABLE `trust_parties` ADD `addressLine1` varchar(255);--> statement-breakpoint
ALTER TABLE `trust_parties` ADD `addressLine2` varchar(255);--> statement-breakpoint
ALTER TABLE `trust_parties` ADD `city` varchar(120);--> statement-breakpoint
ALTER TABLE `trust_parties` ADD `state` varchar(40);--> statement-breakpoint
ALTER TABLE `trust_parties` ADD `postalCode` varchar(20);--> statement-breakpoint
ALTER TABLE `trust_parties` ADD `country` varchar(2) DEFAULT 'US';--> statement-breakpoint
ALTER TABLE `trusts` ADD `firmName` varchar(255);--> statement-breakpoint
ALTER TABLE `trusts` ADD `firmAddress` text;--> statement-breakpoint
ALTER TABLE `trusts` ADD `firmPhone` varchar(80);--> statement-breakpoint
ALTER TABLE `trusts` ADD `firmEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `trusts` ADD `governanceDocs` json NOT NULL DEFAULT (JSON_ARRAY());--> statement-breakpoint
ALTER TABLE `trusts` ADD `constitutionSubtype` enum('none','dao_token_voting','church','unincorporated_association','pma') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `trusts` ADD `trustCategory` enum('private','charitable','statutory') DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE `trusts` ADD `moduleType` enum('revocable_living_trust','private_express_trust','irrevocable_trust','religious_foundation','family_office','parent_company','testamentary_trust','special_purpose_trust') NOT NULL;--> statement-breakpoint
ALTER TABLE `trusts` ADD `formationMode` enum('express','resulting','constructive') DEFAULT 'express' NOT NULL;--> statement-breakpoint
ALTER TABLE `trusts` ADD `commercialEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `trusts` ADD `governanceMode` enum('simple','complex') DEFAULT 'simple' NOT NULL;--> statement-breakpoint
ALTER TABLE `trusts` ADD `governancePackage` enum('none','bylaws_standard','bylaws_foundation','bylaws_religious','bylaws_family_office') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `trusts` ADD `sCorpEligible` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `trusts` ADD `trustSubtype` enum('standard','grantor','QSST','ESBT') DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `trusts` ADD `irsElectionConfirmed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `trusts` ADD `taxonomySource` varchar(50);--> statement-breakpoint
ALTER TABLE `trusts` ADD `taxonomyInferredAt` timestamp;--> statement-breakpoint
ALTER TABLE `trusts` ADD `complexTrustMode` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `trusts` ADD `express` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `trusts` ADD `jurisdictionStateCode` varchar(2);--> statement-breakpoint
ALTER TABLE `trusts` ADD `jurisdictionObjective` enum('ASSET_PROTECTION','STATE_TAX_MINIMIZATION','DIGITAL_ASSET_FIDUCIARY_ACCESS');--> statement-breakpoint
ALTER TABLE `trusts` ADD `jurisdictionHasDigitalAssets` boolean;--> statement-breakpoint
ALTER TABLE `trusts` ADD `jurisdictionSelfSettled` boolean;--> statement-breakpoint
ALTER TABLE `trusts` ADD `jurisdictionScoreSnapshot` int;--> statement-breakpoint
ALTER TABLE `trusts` ADD `jurisdictionReasonsSnapshot` text;--> statement-breakpoint
ALTER TABLE `trusts` ADD `jurisdictionSelectedAt` timestamp;--> statement-breakpoint
ALTER TABLE `trusts` ADD `jurisdictionSelectedByUserId` int;--> statement-breakpoint
CREATE INDEX `ai_agent_collaborators_agent_idx` ON `ai_agent_collaborators` (`agentId`);--> statement-breakpoint
CREATE INDEX `ai_agent_collaborators_user_idx` ON `ai_agent_collaborators` (`userId`);--> statement-breakpoint
CREATE INDEX `ai_agent_knowledge_items_agent_idx` ON `ai_agent_knowledge_items` (`agentId`);--> statement-breakpoint
CREATE INDEX `ai_agent_site_bindings_agent_idx` ON `ai_agent_site_bindings` (`agentId`);--> statement-breakpoint
CREATE INDEX `ai_agent_site_bindings_site_idx` ON `ai_agent_site_bindings` (`siteId`);--> statement-breakpoint
CREATE INDEX `ai_agents_user_idx` ON `ai_agents` (`userId`);--> statement-breakpoint
CREATE INDEX `ai_agents_workspace_idx` ON `ai_agents` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `ai_agents_consultant_idx` ON `ai_agents` (`consultantId`);--> statement-breakpoint
CREATE INDEX `ai_agents_status_idx` ON `ai_agents` (`status`);--> statement-breakpoint
CREATE INDEX `ai_voices_user_idx` ON `ai_voices` (`userId`);--> statement-breakpoint
CREATE INDEX `ai_voices_status_idx` ON `ai_voices` (`status`);--> statement-breakpoint
CREATE INDEX `approvals_target_idx` ON `approvals` (`targetType`,`targetId`);--> statement-breakpoint
CREATE INDEX `approvals_status_idx` ON `approvals` (`status`);--> statement-breakpoint
CREATE INDEX `campasset_campaign_idx` ON `campaign_assets` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `campaudit_user_idx` ON `campaign_audit_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `campaudit_post_idx` ON `campaign_audit_events` (`post_id`);--> statement-breakpoint
CREATE INDEX `campaudit_created_idx` ON `campaign_audit_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `campost_campaign_idx` ON `campaign_posts` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `campost_platform_idx` ON `campaign_posts` (`platform`);--> statement-breakpoint
CREATE INDEX `campost_status_idx` ON `campaign_posts` (`status`);--> statement-breakpoint
CREATE INDEX `campost_scheduled_idx` ON `campaign_posts` (`scheduled_at`);--> statement-breakpoint
CREATE INDEX `camp_user_idx` ON `campaigns` (`user_id`);--> statement-breakpoint
CREATE INDEX `camp_status_idx` ON `campaigns` (`status`);--> statement-breakpoint
CREATE INDEX `cluster_symbols_cluster_id_idx` ON `cluster_symbols` (`clusterId`);--> statement-breakpoint
CREATE INDEX `cluster_symbols_cluster_symbol_idx` ON `cluster_symbols` (`clusterId`,`symbol`);--> statement-breakpoint
CREATE INDEX `consultant_notes_consultant_symbol_timeframe_idx` ON `consultant_notes` (`consultantId`,`symbol`,`timeframe`);--> statement-breakpoint
CREATE INDEX `consultant_notes_consultant_id_idx` ON `consultant_notes` (`consultantId`);--> statement-breakpoint
CREATE INDEX `consultant_watchlists_consultant_id_idx` ON `consultant_watchlists` (`consultantId`);--> statement-breakpoint
CREATE INDEX `consultant_watchlists_consultant_default_idx` ON `consultant_watchlists` (`consultantId`,`isDefault`);--> statement-breakpoint
CREATE INDEX `idx_contact` ON `crm_call_logs` (`contactId`);--> statement-breakpoint
CREATE INDEX `idx_user` ON `crm_call_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_voice_agent` ON `crm_call_logs` (`voiceAgentId`);--> statement-breakpoint
CREATE INDEX `idx_twilio_sid` ON `crm_call_logs` (`twilioCallSid`);--> statement-breakpoint
CREATE INDEX `idx_created` ON `crm_call_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_workspace` ON `crm_contacts` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `idx_user` ON `crm_contacts` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_email` ON `crm_contacts` (`email`);--> statement-breakpoint
CREATE INDEX `idx_contact` ON `crm_conversations` (`contactId`);--> statement-breakpoint
CREATE INDEX `idx_user` ON `crm_conversations` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_channel` ON `crm_conversations` (`channel`);--> statement-breakpoint
CREATE INDEX `idx_last_message` ON `crm_conversations` (`lastMessageAt`);--> statement-breakpoint
CREATE INDEX `idx_conversation` ON `crm_messages` (`conversationId`);--> statement-breakpoint
CREATE INDEX `idx_call_log` ON `crm_messages` (`callLogId`);--> statement-breakpoint
CREATE INDEX `idx_created` ON `crm_messages` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_user` ON `crm_tasks` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_contact` ON `crm_tasks` (`contactId`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `crm_tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_due` ON `crm_tasks` (`dueAt`);--> statement-breakpoint
CREATE INDEX `idx_user_status` ON `crm_tasks` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_user_due` ON `crm_tasks` (`userId`,`dueAt`);--> statement-breakpoint
CREATE INDEX `crypto_bubble_settings_enabled_idx` ON `crypto_bubble_settings` (`isEnabled`);--> statement-breakpoint
CREATE INDEX `crypto_bubble_settings_order_idx` ON `crypto_bubble_settings` (`displayOrder`);--> statement-breakpoint
CREATE INDEX `crypto_transactions_user_idx` ON `crypto_transactions` (`userAddress`);--> statement-breakpoint
CREATE INDEX `crypto_transactions_type_idx` ON `crypto_transactions` (`transactionType`);--> statement-breakpoint
CREATE INDEX `crypto_transactions_status_idx` ON `crypto_transactions` (`status`);--> statement-breakpoint
CREATE INDEX `crypto_transactions_currency_idx` ON `crypto_transactions` (`currency`);--> statement-breakpoint
CREATE INDEX `crypto_transactions_created_at_idx` ON `crypto_transactions` (`createdAt`);--> statement-breakpoint
CREATE INDEX `crypto_transactions_tx_hash_idx` ON `crypto_transactions` (`txHash`);--> statement-breakpoint
CREATE INDEX `currency_prices_currency_idx` ON `currency_prices` (`currency`);--> statement-breakpoint
CREATE INDEX `currency_prices_updated_idx` ON `currency_prices` (`lastUpdated`);--> statement-breakpoint
CREATE INDEX `deed_parties_deedId_idx` ON `deed_parties` (`deedId`);--> statement-breakpoint
CREATE INDEX `deed_parties_role_idx` ON `deed_parties` (`role`);--> statement-breakpoint
CREATE INDEX `deeds_clientId_idx` ON `deeds` (`clientId`);--> statement-breakpoint
CREATE INDEX `deeds_trustId_idx` ON `deeds` (`trustId`);--> statement-breakpoint
CREATE INDEX `deeds_entityId_idx` ON `deeds` (`entityId`);--> statement-breakpoint
CREATE INDEX `deeds_status_idx` ON `deeds` (`status`);--> statement-breakpoint
CREATE INDEX `deeds_approvingResolutionId_idx` ON `deeds` (`approvingResolutionId`);--> statement-breakpoint
CREATE INDEX `deeds_instrumentId_idx` ON `deeds` (`instrumentId`);--> statement-breakpoint
CREATE INDEX `entity_maps_user_idx` ON `entity_maps` (`userId`);--> statement-breakpoint
CREATE INDEX `entity_maps_updated_idx` ON `entity_maps` (`updatedAt`);--> statement-breakpoint
CREATE INDEX `exchange_transactions_user_idx` ON `exchange_transactions` (`userAddress`);--> statement-breakpoint
CREATE INDEX `exchange_transactions_from_currency_idx` ON `exchange_transactions` (`fromCurrency`);--> statement-breakpoint
CREATE INDEX `exchange_transactions_to_currency_idx` ON `exchange_transactions` (`toCurrency`);--> statement-breakpoint
CREATE INDEX `exchange_transactions_status_idx` ON `exchange_transactions` (`status`);--> statement-breakpoint
CREATE INDEX `exchange_transactions_created_at_idx` ON `exchange_transactions` (`createdAt`);--> statement-breakpoint
CREATE INDEX `exhibits_minutesId_idx` ON `exhibits` (`minutesId`);--> statement-breakpoint
CREATE INDEX `exhibits_resolutionId_idx` ON `exhibits` (`resolutionId`);--> statement-breakpoint
CREATE INDEX `generated_documents_sessionId_idx` ON `generated_documents` (`sessionId`);--> statement-breakpoint
CREATE INDEX `indbench_industry_idx` ON `industry_benchmarks` (`industry`);--> statement-breakpoint
CREATE INDEX `indbench_industry_metric_idx` ON `industry_benchmarks` (`industry`,`metric`);--> statement-breakpoint
CREATE INDEX `instruments_trustId_idx` ON `instruments` (`trustId`);--> statement-breakpoint
CREATE INDEX `instruments_entityId_idx` ON `instruments` (`entityId`);--> statement-breakpoint
CREATE INDEX `instruments_concreteId_idx` ON `instruments` (`concreteId`);--> statement-breakpoint
CREATE INDEX `instruments_instrumentType_idx` ON `instruments` (`instrumentType`);--> statement-breakpoint
CREATE INDEX `instruments_status_idx` ON `instruments` (`status`);--> statement-breakpoint
CREATE INDEX `instruments_instrumentHash_idx` ON `instruments` (`instrumentHash`);--> statement-breakpoint
CREATE INDEX `market_clusters_active_idx` ON `market_clusters` (`isActive`);--> statement-breakpoint
CREATE INDEX `market_clusters_order_idx` ON `market_clusters` (`sortOrder`);--> statement-breakpoint
CREATE INDEX `merch_assets_user_idx` ON `merch_assets` (`userId`);--> statement-breakpoint
CREATE INDEX `merch_assets_type_idx` ON `merch_assets` (`type`);--> statement-breakpoint
CREATE INDEX `merch_exports_project_idx` ON `merch_exports` (`projectId`);--> statement-breakpoint
CREATE INDEX `merch_exports_type_idx` ON `merch_exports` (`type`);--> statement-breakpoint
CREATE INDEX `merch_jobs_status_idx` ON `merch_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `merch_jobs_type_idx` ON `merch_jobs` (`type`);--> statement-breakpoint
CREATE INDEX `merch_orders_user_idx` ON `merch_orders` (`userId`);--> statement-breakpoint
CREATE INDEX `merch_orders_project_idx` ON `merch_orders` (`projectId`);--> statement-breakpoint
CREATE INDEX `merch_orders_status_idx` ON `merch_orders` (`status`);--> statement-breakpoint
CREATE INDEX `merch_projects_user_idx` ON `merch_projects` (`userId`);--> statement-breakpoint
CREATE INDEX `merch_projects_lane_idx` ON `merch_projects` (`lane`);--> statement-breakpoint
CREATE INDEX `merch_renders_version_idx` ON `merch_renders` (`versionId`);--> statement-breakpoint
CREATE INDEX `merch_versions_project_idx` ON `merch_versions` (`projectId`);--> statement-breakpoint
CREATE INDEX `minute_books_clientId_idx` ON `minute_books` (`clientId`);--> statement-breakpoint
CREATE INDEX `minute_books_entityId_idx` ON `minute_books` (`entityId`);--> statement-breakpoint
CREATE INDEX `minute_books_trustId_idx` ON `minute_books` (`trustId`);--> statement-breakpoint
CREATE INDEX `minute_participants_minutesId_idx` ON `minute_participants` (`minutesId`);--> statement-breakpoint
CREATE INDEX `minutes_minuteBookId_idx` ON `minutes` (`minuteBookId`);--> statement-breakpoint
CREATE INDEX `minutes_status_idx` ON `minutes` (`status`);--> statement-breakpoint
CREATE INDEX `model_plans_user_idx` ON `model_plans` (`userId`);--> statement-breakpoint
CREATE INDEX `model_plans_trust_idx` ON `model_plans` (`trustId`);--> statement-breakpoint
CREATE INDEX `model_plans_kind_idx` ON `model_plans` (`planKind`);--> statement-breakpoint
CREATE INDEX `nft_activity_nft_idx` ON `nft_activity` (`nftId`);--> statement-breakpoint
CREATE INDEX `nft_collections_chain_idx` ON `nft_collections` (`chain`);--> statement-breakpoint
CREATE INDEX `nft_collections_creator_idx` ON `nft_collections` (`creatorAddress`);--> statement-breakpoint
CREATE INDEX `nft_collections_verified_idx` ON `nft_collections` (`isVerified`);--> statement-breakpoint
CREATE INDEX `nft_listings_seller_idx` ON `nft_listings` (`sellerAddress`);--> statement-breakpoint
CREATE INDEX `nft_listings_status_idx` ON `nft_listings` (`status`);--> statement-breakpoint
CREATE INDEX `nft_listings_nft_status_idx` ON `nft_listings` (`nftId`,`status`);--> statement-breakpoint
CREATE INDEX `nft_sales_nft_idx` ON `nft_sales` (`nftId`);--> statement-breakpoint
CREATE INDEX `nft_sales_seller_idx` ON `nft_sales` (`sellerAddress`);--> statement-breakpoint
CREATE INDEX `nft_sales_buyer_idx` ON `nft_sales` (`buyerAddress`);--> statement-breakpoint
CREATE INDEX `nft_sales_sold_date_idx` ON `nft_sales` (`soldAt`);--> statement-breakpoint
CREATE INDEX `nfts_chain_token_idx` ON `nfts` (`chain`,`tokenId`);--> statement-breakpoint
CREATE INDEX `nfts_owner_idx` ON `nfts` (`ownerAddress`);--> statement-breakpoint
CREATE INDEX `nfts_creator_idx` ON `nfts` (`creatorAddress`);--> statement-breakpoint
CREATE INDEX `nfts_collection_idx` ON `nfts` (`collectionId`);--> statement-breakpoint
CREATE INDEX `nfts_listed_idx` ON `nfts` (`isListed`);--> statement-breakpoint
CREATE INDEX `nfts_staked_idx` ON `nfts` (`isStaked`);--> statement-breakpoint
CREATE INDEX `oasis_asset_packs_created_by_idx` ON `oasis_asset_packs` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `oasis_asset_packs_published_idx` ON `oasis_asset_packs` (`isPublished`);--> statement-breakpoint
CREATE INDEX `oasis_market_licenses_user_idx` ON `oasis_market_licenses` (`userId`);--> statement-breakpoint
CREATE INDEX `oasis_market_listings_item_idx` ON `oasis_market_listings` (`itemType`,`itemRefId`);--> statement-breakpoint
CREATE INDEX `oasis_market_listings_published_idx` ON `oasis_market_listings` (`isPublished`);--> statement-breakpoint
CREATE INDEX `oasis_market_listings_created_by_idx` ON `oasis_market_listings` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `oasis_market_purchases_user_idx` ON `oasis_market_purchases` (`userId`);--> statement-breakpoint
CREATE INDEX `oasis_market_purchases_item_idx` ON `oasis_market_purchases` (`itemType`,`itemRefId`);--> statement-breakpoint
CREATE INDEX `oasis_npc_knowledge_npc_idx` ON `oasis_npc_knowledge` (`npcId`);--> statement-breakpoint
CREATE INDEX `oasis_npc_messages_session_idx` ON `oasis_npc_messages` (`sessionId`);--> statement-breakpoint
CREATE INDEX `oasis_npc_sessions_npc_idx` ON `oasis_npc_sessions` (`npcNpcId`);--> statement-breakpoint
CREATE INDEX `oasis_npc_sessions_user_idx` ON `oasis_npc_sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `oasis_placements_space_idx` ON `oasis_placements` (`spaceId`);--> statement-breakpoint
CREATE INDEX `oasis_world_events_world_idx` ON `oasis_world_events` (`worldId`);--> statement-breakpoint
CREATE INDEX `oasis_world_events_created_at_idx` ON `oasis_world_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `oasis_world_versions_world_idx` ON `oasis_world_versions` (`worldId`);--> statement-breakpoint
CREATE INDEX `oasis_world_versions_created_at_idx` ON `oasis_world_versions` (`createdAt`);--> statement-breakpoint
CREATE INDEX `oasis_worlds_created_by_idx` ON `oasis_worlds` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `oasis_worlds_published_idx` ON `oasis_worlds` (`isPublished`);--> statement-breakpoint
CREATE INDEX `offer_assets_offer_idx` ON `offer_assets` (`offerId`);--> statement-breakpoint
CREATE INDEX `offers_user_idx` ON `offers` (`userId`);--> statement-breakpoint
CREATE INDEX `offers_status_idx` ON `offers` (`status`);--> statement-breakpoint
CREATE INDEX `public_witnesses_instrumentId_idx` ON `public_witnesses` (`instrumentId`);--> statement-breakpoint
CREATE INDEX `public_witnesses_txHash_idx` ON `public_witnesses` (`txHash`);--> statement-breakpoint
CREATE INDEX `public_witnesses_witnessHash_idx` ON `public_witnesses` (`witnessHash`);--> statement-breakpoint
CREATE INDEX `resolution_votes_resolutionId_idx` ON `resolution_votes` (`resolutionId`);--> statement-breakpoint
CREATE INDEX `resolutions_minutesId_idx` ON `resolutions` (`minutesId`);--> statement-breakpoint
CREATE INDEX `resolutions_status_idx` ON `resolutions` (`status`);--> statement-breakpoint
CREATE INDEX `revosapp_email_idx` ON `revenue_os_applications` (`email`);--> statement-breakpoint
CREATE INDEX `revosapp_status_idx` ON `revenue_os_applications` (`status`);--> statement-breakpoint
CREATE INDEX `revosxp_user_idx` ON `revenue_os_experiments` (`user_id`);--> statement-breakpoint
CREATE INDEX `revosxp_status_idx` ON `revenue_os_experiments` (`status`);--> statement-breakpoint
CREATE INDEX `snap_user_idx` ON `revenue_os_monthly_snapshots` (`user_id`);--> statement-breakpoint
CREATE INDEX `snap_client_idx` ON `revenue_os_monthly_snapshots` (`client_id`);--> statement-breakpoint
CREATE INDEX `snap_trust_idx` ON `revenue_os_monthly_snapshots` (`trust_id`);--> statement-breakpoint
CREATE INDEX `snap_month_idx` ON `revenue_os_monthly_snapshots` (`month`);--> statement-breakpoint
CREATE INDEX `revosrun_user_idx` ON `revenue_os_runs` (`user_id`);--> statement-breakpoint
CREATE INDEX `revosrun_profile_idx` ON `revenue_os_runs` (`profileId`);--> statement-breakpoint
CREATE INDEX `revosrun_hash_idx` ON `revenue_os_runs` (`inputHash`);--> statement-breakpoint
CREATE INDEX `revoscen_created_by_idx` ON `revenue_os_scenarios` (`created_by`);--> statement-breakpoint
CREATE INDEX `revoscen_created_at_idx` ON `revenue_os_scenarios` (`created_at`);--> statement-breakpoint
CREATE INDEX `revos_api_user_workspace_idx` ON `revenue_os_workspace_apis` (`user_id`,`client_id`,`trust_id`);--> statement-breakpoint
CREATE INDEX `revos_api_user_idx` ON `revenue_os_workspace_apis` (`user_id`);--> statement-breakpoint
CREATE INDEX `revprof_user_idx` ON `revenue_profiles` (`user_id`);--> statement-breakpoint
CREATE INDEX `revprof_client_idx` ON `revenue_profiles` (`client_id`);--> statement-breakpoint
CREATE INDEX `revprof_trust_idx` ON `revenue_profiles` (`trust_id`);--> statement-breakpoint
CREATE INDEX `revprof_wallet_idx` ON `revenue_profiles` (`walletAddress`);--> statement-breakpoint
CREATE INDEX `trademark_projects_user_idx` ON `trademark_projects` (`userId`);--> statement-breakpoint
CREATE INDEX `trademark_projects_status_idx` ON `trademark_projects` (`status`);--> statement-breakpoint
CREATE INDEX `trademark_projects_updated_idx` ON `trademark_projects` (`updatedAt`);--> statement-breakpoint
CREATE INDEX `trust_scene_plan_records_trust_idx` ON `trust_scene_plan_records` (`trustId`);--> statement-breakpoint
CREATE INDEX `trust_scene_plan_records_user_idx` ON `trust_scene_plan_records` (`userId`);--> statement-breakpoint
CREATE INDEX `trust_scene_plan_records_plan_idx` ON `trust_scene_plan_records` (`planId`);--> statement-breakpoint
CREATE INDEX `user_wallets_user_idx` ON `user_wallets` (`userAddress`);--> statement-breakpoint
CREATE INDEX `user_wallets_currency_idx` ON `user_wallets` (`currency`);--> statement-breakpoint
CREATE INDEX `user_wallets_chain_idx` ON `user_wallets` (`chain`);--> statement-breakpoint
CREATE INDEX `wallet_activity_log_user_idx` ON `wallet_activity_log` (`userAddress`);--> statement-breakpoint
CREATE INDEX `wallet_activity_log_type_idx` ON `wallet_activity_log` (`activityType`);--> statement-breakpoint
CREATE INDEX `wallet_activity_log_created_at_idx` ON `wallet_activity_log` (`createdAt`);--> statement-breakpoint
CREATE INDEX `watchlist_symbols_watchlist_id_idx` ON `watchlist_symbols` (`watchlistId`);--> statement-breakpoint
CREATE INDEX `watchlist_symbols_watchlist_symbol_idx` ON `watchlist_symbols` (`watchlistId`,`symbol`);--> statement-breakpoint
CREATE INDEX `web3_site_templates_user_idx` ON `web3_site_templates` (`userId`);--> statement-breakpoint
CREATE INDEX `web3_site_templates_trust_idx` ON `web3_site_templates` (`trustId`);--> statement-breakpoint
CREATE INDEX `web3_site_templates_workspace_idx` ON `web3_site_templates` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `web3_site_templates_name_idx` ON `web3_site_templates` (`name`);--> statement-breakpoint
CREATE INDEX `web3_site_versions_site_idx` ON `web3_site_versions` (`siteId`);--> statement-breakpoint
CREATE INDEX `web3_site_versions_hash_idx` ON `web3_site_versions` (`schemaHash`);--> statement-breakpoint
CREATE INDEX `web3_sites_user_idx` ON `web3_sites` (`userId`);--> statement-breakpoint
CREATE INDEX `web3_sites_trust_idx` ON `web3_sites` (`trustId`);--> statement-breakpoint
CREATE INDEX `web3_sites_workspace_idx` ON `web3_sites` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `web3_sites_status_idx` ON `web3_sites` (`status`);--> statement-breakpoint
CREATE INDEX `web3_sites_slug_idx` ON `web3_sites` (`slug`);--> statement-breakpoint
CREATE INDEX `wizard_sessions_userId_kind_idx` ON `wizard_sessions` (`userId`,`kind`);--> statement-breakpoint
CREATE INDEX `wizard_sessions_trustId_kind_idx` ON `wizard_sessions` (`trustId`,`kind`);--> statement-breakpoint
CREATE INDEX `idx_trust_debt_instruments_bondNumber` ON `trust_debt_instruments` (`bondNumber`);