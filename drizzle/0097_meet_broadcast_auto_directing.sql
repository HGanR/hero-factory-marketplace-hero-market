-- V2 auto-directing policy + debounce + last decision (polling; one row per broadcast session).
-- Restored after file was emptied; if TiDB already applied, align checksum only.

CREATE TABLE IF NOT EXISTS `meet_broadcast_auto_directing_states` (
  `id` int NOT NULL AUTO_INCREMENT,
  `broadcast_session_id` int NOT NULL,
  `user_id` int NOT NULL,
  `directing_state_json` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `mbads_broadcast_uidx` (`broadcast_session_id`),
  KEY `mbads_updated_idx` (`updated_at`)
);
