-- In-app notification center: per-event read state on bentley_notification_events
ALTER TABLE `bentley_notification_events`
  ADD COLUMN `read_at` timestamp NULL DEFAULT NULL AFTER `created_at`;
