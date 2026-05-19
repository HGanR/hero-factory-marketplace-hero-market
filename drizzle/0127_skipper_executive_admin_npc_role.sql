-- SKIPPER NPC was seeded with role `voice_agent`, which triggers receptionist fallbacks in the NPC rule engine.
-- Add `executive_admin` to the enum and migrate exec-skipper-v1.

ALTER TABLE `oasis_npcs`
  MODIFY COLUMN `role` ENUM('secretary','avatar','guide','voice_agent','executive_admin') NOT NULL;

UPDATE `oasis_npcs`
SET `role` = 'executive_admin'
WHERE `npcId` = 'exec-skipper-v1';
--> statement-breakpoint
-- AI Agency runtime discriminator (SKIPPER and other executive desks)

ALTER TABLE `ai_agents`
  ADD COLUMN `agentRuntimeType` VARCHAR(32) NULL;
--> statement-breakpoint

UPDATE `ai_agents`
SET `agentRuntimeType` = 'executive_admin'
WHERE `id` = 'a1000001-0001-4001-8001-000000000001'
   OR UPPER(TRIM(`name`)) = 'SKIPPER';
