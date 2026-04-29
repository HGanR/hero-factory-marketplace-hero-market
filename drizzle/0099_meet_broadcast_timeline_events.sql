-- Session-centric operational timeline (analytics / post-run review; additive)

CREATE TABLE IF NOT EXISTS `meet_broadcast_timeline_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `broadcast_session_id` int NOT NULL,
  `user_id` int NOT NULL,
  `event_type` varchar(64) NOT NULL,
  `summary` varchar(512) NOT NULL,
  `details_json` json NULL,
  `event_at` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `meet_broadcast_timeline_events_id` PRIMARY KEY (`id`),
  KEY `mbt_e_session_event_at` (`broadcast_session_id`, `event_at`),
  KEY `mbt_e_user_created` (`user_id`, `created_at`)
);
