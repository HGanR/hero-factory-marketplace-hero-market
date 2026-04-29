-- Calendar-backed broadcast events + reusable run-of-show timeline templates (V2-focused; additive)

CREATE TABLE IF NOT EXISTS `meet_broadcast_timeline_templates` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `name` varchar(160) NOT NULL,
  `template_json` json NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `meet_broadcast_timeline_templates_id` PRIMARY KEY (`id`),
  KEY `mbtt_user_idx` (`user_id`)
);

CREATE TABLE IF NOT EXISTS `meet_broadcast_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `title` varchar(240) NOT NULL,
  `description` text,
  `scheduled_start_at` timestamp NOT NULL,
  `scheduled_end_at` timestamp NULL,
  `timezone` varchar(64),
  `room_id` varchar(256),
  `status` varchar(32) NOT NULL DEFAULT 'draft',
  `scene_preset_id` int NULL,
  `default_timeline_template_id` int NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `meet_broadcast_events_id` PRIMARY KEY (`id`),
  KEY `mbe_user_start_idx` (`user_id`, `scheduled_start_at`),
  KEY `mbe_user_status_idx` (`user_id`, `status`)
);

-- Split for TiDB/MySQL: single ALTER with ADD COLUMN + KEY can error; omit AFTER so drift on
-- compositor columns does not block this migration.
ALTER TABLE `meet_broadcast_sessions` ADD COLUMN `broadcast_event_id` int NULL;
ALTER TABLE `meet_broadcast_sessions` ADD KEY `mbs_broadcast_event_idx` (`broadcast_event_id`);
