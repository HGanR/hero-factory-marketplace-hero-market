-- V2 operator schedule / countdown / automation (polling-evaluated; one row per broadcast session).

CREATE TABLE IF NOT EXISTS `meet_broadcast_schedule_states` (
  `id` int NOT NULL AUTO_INCREMENT,
  `broadcast_session_id` int NOT NULL,
  `user_id` int NOT NULL,
  `schedule_state_json` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `mbss_broadcast_uidx` (`broadcast_session_id`),
  KEY `mbss_updated_idx` (`updated_at`)
);
