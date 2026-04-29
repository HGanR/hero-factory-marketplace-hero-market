-- Reusable show packages, overlay preset packs, guest card packs; additive to broadcast events

CREATE TABLE IF NOT EXISTS `meet_broadcast_overlay_packs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `name` varchar(160) NOT NULL,
  `description` varchar(2000) NULL,
  `lower_third_preset_json` json NULL,
  `ticker_preset_json` json NULL,
  `cta_preset_json` json NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `meet_broadcast_overlay_packs_id` PRIMARY KEY (`id`),
  KEY `mbop_user_idx` (`user_id`)
);

CREATE TABLE IF NOT EXISTS `meet_broadcast_guest_card_packs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `name` varchar(160) NOT NULL,
  `description` varchar(2000) NULL,
  `guest_cards_json` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `meet_broadcast_guest_card_packs_id` PRIMARY KEY (`id`),
  KEY `mbgcp_user_idx` (`user_id`)
);

CREATE TABLE IF NOT EXISTS `meet_broadcast_show_packages` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `name` varchar(160) NOT NULL,
  `description` varchar(2000) NULL,
  `scene_preset_id` int NULL,
  `timeline_template_id` int NULL,
  `default_branding_json` json NULL,
  `default_overlay_pack_id` int NULL,
  `default_guest_card_pack_id` int NULL,
  `default_room_id` varchar(256) NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `meet_broadcast_show_packages_id` PRIMARY KEY (`id`),
  KEY `mbsp_user_idx` (`user_id`),
  KEY `mbsp_user_default_idx` (`user_id`, `is_default`)
);

-- Split for TiDB/MySQL: single ALTER with ADD COLUMN + KEY can error ("column does not exist").
ALTER TABLE `meet_broadcast_events` ADD COLUMN `show_package_id` int NULL;
ALTER TABLE `meet_broadcast_events` ADD KEY `mbe_show_package_idx` (`show_package_id`);
