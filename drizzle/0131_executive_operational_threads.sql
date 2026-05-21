-- Internal executive operational threads (not client inbox / email / SMS)
CREATE TABLE IF NOT EXISTS `executive_operational_threads` (
  `id` varchar(36) NOT NULL,
  `adminUserId` int NOT NULL,
  `title` varchar(500) NOT NULL,
  `threadKind` enum('subject','department','fulfillment_case','approval','internal_note') NOT NULL,
  `status` enum('open','monitoring','resolved','archived') NOT NULL DEFAULT 'open',
  `priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  `subjectId` varchar(64),
  `department` varchar(32),
  `clientId` varchar(191),
  `orderId` varchar(191),
  `approvalId` varchar(36),
  `decisionNeeded` boolean NOT NULL DEFAULT false,
  `pinnedNoteText` text,
  `memorySummary` text,
  `unresolvedQuestionCount` int NOT NULL DEFAULT 0,
  `lastMessageAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `executive_operational_threads_id` PRIMARY KEY(`id`),
  KEY `executive_operational_threads_admin` (`adminUserId`),
  KEY `executive_operational_threads_subject` (`adminUserId`, `subjectId`),
  KEY `executive_operational_threads_order` (`adminUserId`, `orderId`),
  KEY `executive_operational_threads_approval` (`adminUserId`, `approvalId`)
);

CREATE TABLE IF NOT EXISTS `executive_operational_thread_messages` (
  `id` varchar(36) NOT NULL,
  `threadId` varchar(36) NOT NULL,
  `adminUserId` int NOT NULL,
  `bodyText` text NOT NULL,
  `messageKind` enum('discussion','operational_note','question','decision_request','status_update','owner_annotation') NOT NULL DEFAULT 'discussion',
  `priorityTag` varchar(32),
  `isPinned` boolean NOT NULL DEFAULT false,
  `ownerOnly` boolean NOT NULL DEFAULT false,
  `metadataJson` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `executive_operational_thread_messages_id` PRIMARY KEY(`id`),
  KEY `executive_operational_thread_messages_thread` (`threadId`, `createdAt`)
);
