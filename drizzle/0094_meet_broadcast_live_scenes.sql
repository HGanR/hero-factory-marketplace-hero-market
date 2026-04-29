-- Live scene operator state for V2 rendered compositor (polling-based updates; no egress restart).

CREATE TABLE IF NOT EXISTS `meet_broadcast_live_scene_states` (
  `id` int NOT NULL AUTO_INCREMENT,
  `broadcast_session_id` int NOT NULL,
  `user_id` int NOT NULL,
  `scene_state_json` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `mblss_broadcast_uidx` (`broadcast_session_id`),
  KEY `mblss_updated_idx` (`updated_at`)
);
