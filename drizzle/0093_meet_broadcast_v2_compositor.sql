-- V2 rendered broadcast compositor: short-lived render sessions + session compositor metadata.

CREATE TABLE IF NOT EXISTS `meet_broadcast_render_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `broadcast_session_id` int NOT NULL,
  `user_id` int NOT NULL,
  `access_token` varchar(64) NOT NULL,
  `render_model_json` json NOT NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `mbrs_token_uq` (`access_token`),
  KEY `mbrs_broadcast_idx` (`broadcast_session_id`),
  KEY `mbrs_expires_idx` (`expires_at`)
);

ALTER TABLE `meet_broadcast_sessions` ADD COLUMN `compositor_mode` varchar(32) NOT NULL DEFAULT 'v1_livekit_default';
ALTER TABLE `meet_broadcast_sessions` ADD COLUMN `render_session_id` int NULL;
ALTER TABLE `meet_broadcast_sessions` ADD COLUMN `compositor_fallback_from_v2` tinyint(1) NOT NULL DEFAULT 0;
