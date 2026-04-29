-- NPC Q&A - Gatekeeper Questions
CREATE TABLE IF NOT EXISTS `oasis_npc_qa` (
  `id` int AUTO_INCREMENT NOT NULL,
  `npcId` int NOT NULL,
  `question` text NOT NULL,
  `correctAnswers` text NOT NULL,
  `wrongAnswerResponse` text NOT NULL,
  `successResponse` text,
  `orderIndex` int NOT NULL DEFAULT 0,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `oasis_npc_qa_id` PRIMARY KEY(`id`)
);

CREATE INDEX `oasis_npc_qa_npc_idx` ON `oasis_npc_qa` (`npcId`);
CREATE INDEX `oasis_npc_qa_order_idx` ON `oasis_npc_qa` (`npcId`, `orderIndex`);
