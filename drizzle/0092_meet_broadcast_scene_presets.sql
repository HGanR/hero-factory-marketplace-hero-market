-- Broadcast scene presets + session scene snapshot (V1 metadata).

CREATE TABLE IF NOT EXISTS `meet_broadcast_scene_presets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `name` varchar(120) NOT NULL,
  `config_json` json NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `mbsp_user_idx` (`user_id`)
);

ALTER TABLE `meet_broadcast_sessions` ADD COLUMN `scene_config_json` json NULL;
