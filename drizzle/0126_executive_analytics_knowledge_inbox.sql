-- Site-wide marketing / landing analytics (public ingest + admin read)
CREATE TABLE IF NOT EXISTS `site_analytics_events` (
  `id` varchar(36) NOT NULL,
  `sessionId` varchar(64) NOT NULL,
  `visitorId` varchar(64) NOT NULL,
  `path` varchar(512) NOT NULL,
  `eventType` enum(
    'page_view',
    'button_click',
    'conversion_intent',
    'outbound_paypal',
    'agent_interaction'
  ) NOT NULL,
  `source` varchar(64) NOT NULL DEFAULT '',
  `medium` varchar(64) NOT NULL DEFAULT '',
  `campaign` varchar(128) NOT NULL DEFAULT '',
  `referrer` text,
  `userAgent` text,
  `metadataJson` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `site_analytics_events_id` PRIMARY KEY(`id`),
  KEY `site_analytics_events_created_idx` (`createdAt`),
  KEY `site_analytics_events_type_created_idx` (`eventType`,`createdAt`),
  KEY `site_analytics_events_path_created_idx` (`path`(191),`createdAt`),
  KEY `site_analytics_events_source_created_idx` (`source`,`createdAt`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `executive_agent_question_history` (
  `id` varchar(36) NOT NULL,
  `adminUserId` int NOT NULL,
  `source` enum('chat','voice') NOT NULL,
  `question` text NOT NULL,
  `answer` text NOT NULL,
  `selectedAgentsJson` text,
  `selectedTimeRange` varchar(32),
  `dashboardMode` varchar(64),
  `plannerMetaJson` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `executive_agent_question_history_id` PRIMARY KEY(`id`),
  KEY `ea_question_hist_admin_created_idx` (`adminUserId`,`createdAt`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `executive_agent_knowledge_documents` (
  `id` varchar(36) NOT NULL,
  `adminUserId` int NOT NULL,
  `title` varchar(500) NOT NULL,
  `sourceType` enum('note','url','upload','crawl') NOT NULL,
  `sourceUrl` text,
  `contentText` longtext NOT NULL,
  `summary` text,
  `metadataJson` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `executive_agent_knowledge_documents_id` PRIMARY KEY(`id`),
  KEY `ea_knowledge_admin_updated_idx` (`adminUserId`,`updatedAt`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `executive_department_messages` (
  `id` varchar(36) NOT NULL,
  `kind` enum('user_to_executive','executive_to_user','executive_broadcast') NOT NULL,
  `fromAdminUserId` int,
  `fromMarketplaceUserId` int,
  `toMarketplaceUserId` int,
  `bodyText` text NOT NULL,
  `metadataJson` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `executive_department_messages_id` PRIMARY KEY(`id`),
  KEY `exec_dept_msg_to_user_idx` (`toMarketplaceUserId`,`createdAt`),
  KEY `exec_dept_msg_from_user_idx` (`fromMarketplaceUserId`,`createdAt`),
  KEY `exec_dept_msg_kind_created_idx` (`kind`,`createdAt`)
);
--> statement-breakpoint
-- SKIPPER NPC (idempotent)
INSERT IGNORE INTO `oasis_npcs` (
  `npcId`,
  `name`,
  `role`,
  `title`,
  `avatarEmoji`,
  `isActive`,
  `greeting`,
  `personalityJson`
) VALUES (
  'exec-skipper-v1',
  'SKIPPER',
  'voice_agent',
  'Executive Administration — cross-NPC intelligence',
  '🎙️',
  1,
  'SKIPPER online — I coordinate executive workflows, read OASIS NPC traffic, and surface knowledge you save for this desk.',
  '{"friendliness":75,"formality":60,"verbosity":45,"humor":25,"patience":80,"expertise":90}'
);
--> statement-breakpoint
-- SKIPPER marketplace AI agent row: bind to first approved marketplace user when present (idempotent id)
INSERT INTO `ai_agents` (
  `id`,
  `userId`,
  `name`,
  `description`,
  `status`,
  `systemPrompt`,
  `createdAt`,
  `updatedAt`
)
SELECT
  'a1000001-0001-4001-8001-000000000001',
  `id`,
  'SKIPPER',
  'Executive orchestration agent: reads NPC conversations, executive knowledge, analytics, and department inbox context. Writes still require human approval.',
  'active',
  'You are SKIPPER, the Executive Administration agent. You only propose actions; you never execute privileged writes without an approval record. Prefer concise operational answers and cite which systems you used.',
  NOW(),
  NOW()
FROM `marketplace_users`
WHERE `isApproved` = 1
ORDER BY `id` ASC
LIMIT 1
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `status` = 'active',
  `systemPrompt` = VALUES(`systemPrompt`),
  `updatedAt` = NOW();
