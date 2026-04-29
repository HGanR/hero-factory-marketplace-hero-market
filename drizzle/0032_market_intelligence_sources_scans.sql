-- Module 1: market_sources provenance + scan listing; idempotent ALTERs.
ALTER TABLE `market_sources`
  ADD COLUMN `last_market_scan_id` VARCHAR(36) NULL AFTER `source_type`;

-- Dedupe by citation URL (nullable column may have multiple NULLs in MySQL).
CREATE UNIQUE INDEX `mkt_src_url_uidx` ON `market_sources` (`url`(512));

CREATE INDEX `mkt_scan_user_client_created_idx` ON `market_scans` (`user_id`, `client_id`, `created_at`);
