-- Ensure `campaigns` exists for TiDB/MySQL minimal & partial-migration DBs (single statement; errno 8130 safe).
-- Matches baseline shape from `0001_add_marketplace_phone.sql` plus `bentley_autopilot_publish`.
-- If the table already exists (normal path after 0001), this is a no-op; use `0119` to add the column.
CREATE TABLE IF NOT EXISTS `campaigns` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `client_id` varchar(36) NOT NULL DEFAULT '',
  `name` varchar(200) NOT NULL,
  `objective` varchar(200),
  `status` varchar(24) NOT NULL DEFAULT 'DRAFT',
  `start_at` timestamp NULL,
  `end_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `bentley_autopilot_publish` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `camp_user_idx` (`user_id`),
  KEY `camp_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
