-- Add autopilot column when `campaigns` already existed without it (single statement for TiDB errno 8130).
ALTER TABLE `campaigns` ADD COLUMN IF NOT EXISTS `bentley_autopilot_publish` tinyint(1) NOT NULL DEFAULT 0;
