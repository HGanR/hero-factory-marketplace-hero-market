-- Sticky Jarva specialist lane per NPC chat session (trust-advisor)
ALTER TABLE `oasis_npc_sessions` ADD COLUMN `jarvaWorkflowPath` VARCHAR(64) NULL;
