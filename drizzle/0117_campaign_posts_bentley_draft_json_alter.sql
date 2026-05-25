-- Existing `campaign_posts` (created before Bentley draft column): add column when missing.
-- TiDB / MySQL 8.0.29+ compatible `ADD COLUMN IF NOT EXISTS` (see TiDB ADD COLUMN synopsis).
-- Single statement for TiDB errno 8130.
ALTER TABLE `campaign_posts` ADD COLUMN IF NOT EXISTS `bentley_draft_json` JSON NULL AFTER `caption`;
