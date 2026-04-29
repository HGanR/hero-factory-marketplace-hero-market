-- Bentley: connector-aware routing metadata on distribution queue targets

ALTER TABLE `bentley_distribution_queue_targets`
  ADD COLUMN IF NOT EXISTS `routing_status` varchar(48) NULL DEFAULT NULL;

ALTER TABLE `bentley_distribution_queue_targets`
  ADD COLUMN IF NOT EXISTS `routing_warnings_json` json NULL DEFAULT NULL;
