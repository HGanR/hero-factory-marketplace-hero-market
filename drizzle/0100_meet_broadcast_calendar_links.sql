-- External calendar linkage for broadcast events (explicit user-driven sync; additive)

CREATE TABLE IF NOT EXISTS `meet_broadcast_calendar_links` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `broadcast_event_id` int NOT NULL,
  `provider` varchar(32) NOT NULL,
  `external_calendar_id` varchar(256) NULL,
  `external_event_id` varchar(256) NULL,
  `external_event_url` varchar(512) NULL,
  `sync_mode` varchar(40) NOT NULL,
  `last_synced_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `meet_broadcast_calendar_links_id` PRIMARY KEY (`id`),
  UNIQUE KEY `mbcal_broadcast_event_uidx` (`broadcast_event_id`),
  KEY `mbcal_user_idx` (`user_id`)
);
