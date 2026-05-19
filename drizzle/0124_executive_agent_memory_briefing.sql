-- Executive operational memory + daily briefings (no auto-write from chat; APIs persist explicitly)

CREATE TABLE IF NOT EXISTS `executive_agent_memory_items` (
  `id` VARCHAR(36) NOT NULL,
  `adminUserId` INT NOT NULL,
  `memoryType` ENUM(
    'preference',
    'client_priority',
    'recurring_issue',
    'agent_pattern',
    'system_note',
    'decision'
  ) NOT NULL,
  `subjectType` VARCHAR(64) NULL,
  `subjectId` VARCHAR(191) NULL,
  `title` VARCHAR(500) NOT NULL,
  `summary` LONGTEXT NOT NULL,
  `source` ENUM('chat','voice','approval','system') NOT NULL,
  `confidence` DECIMAL(5,4) NOT NULL DEFAULT 0.8000,
  `expiresAt` TIMESTAMP NULL,
  `archivedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `executive_memory_admin_type_idx` (`adminUserId`, `memoryType`),
  KEY `executive_memory_admin_created_idx` (`adminUserId`, `createdAt`),
  KEY `executive_memory_expires_idx` (`expiresAt`),
  KEY `executive_memory_archived_idx` (`archivedAt`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `executive_agent_briefings` (
  `id` VARCHAR(36) NOT NULL,
  `adminUserId` INT NOT NULL,
  `briefingDate` VARCHAR(10) NOT NULL,
  `summaryJson` LONGTEXT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `executive_briefings_admin_date` (`adminUserId`, `briefingDate`),
  KEY `executive_briefings_admin_idx` (`adminUserId`)
);
