-- Client branding + services (used by POST /api/clients, dashboard Micro Terminal).
-- Previously only ensured at runtime in code; applying here avoids TiDB/metadata-lock issues during requests.
-- Requires MySQL 8.0.29+ / TiDB with ADD COLUMN IF NOT EXISTS support.

ALTER TABLE `clients` ADD COLUMN IF NOT EXISTS `logoUrl` TEXT;--> statement-breakpoint
ALTER TABLE `clients` ADD COLUMN IF NOT EXISTS `servicesJson` TEXT;--> statement-breakpoint
