-- Meet multi-destination RTMP broadcast (LiveKit egress fan-out).
-- Stream keys stored encrypted server-side; API never returns plaintext keys.

CREATE TABLE IF NOT EXISTS `stream_destinations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `platform` varchar(32) NOT NULL,
  `label` varchar(120) NOT NULL DEFAULT '',
  `server_url` varchar(1024) NOT NULL DEFAULT '',
  `stream_key_encrypted` text NOT NULL,
  `stream_key_last4` varchar(8) NOT NULL DEFAULT '',
  `orientation_preference` varchar(16) NOT NULL DEFAULT 'auto',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `requires_manual_go_live` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `last_tested_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `stream_destinations_user_idx` (`user_id`),
  KEY `stream_destinations_user_active_idx` (`user_id`, `is_active`)
);

CREATE TABLE IF NOT EXISTS `meet_broadcast_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `room_id` varchar(256) NOT NULL,
  `user_id` int NOT NULL,
  `livekit_egress_id` varchar(128) NOT NULL DEFAULT '',
  `status` varchar(32) NOT NULL DEFAULT 'starting',
  `started_at` timestamp NULL DEFAULT NULL,
  `ended_at` timestamp NULL DEFAULT NULL,
  `layout_mode` varchar(64) NOT NULL DEFAULT 'grid',
  `recording_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `meet_broadcast_sessions_room_idx` (`room_id`),
  KEY `meet_broadcast_sessions_user_idx` (`user_id`),
  KEY `meet_broadcast_sessions_room_status_idx` (`room_id`, `status`)
);

CREATE TABLE IF NOT EXISTS `meet_broadcast_session_destinations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `broadcast_session_id` int NOT NULL,
  `stream_destination_id` int NOT NULL,
  `platform` varchar(32) NOT NULL,
  `label` varchar(120) NOT NULL DEFAULT '',
  `resolved_output_url_masked` varchar(2048) NOT NULL DEFAULT '',
  `status` varchar(32) NOT NULL DEFAULT 'pending',
  `last_error` text,
  `started_at` timestamp NULL DEFAULT NULL,
  `ended_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `mbsd_session_idx` (`broadcast_session_id`),
  KEY `mbsd_dest_idx` (`stream_destination_id`)
);
