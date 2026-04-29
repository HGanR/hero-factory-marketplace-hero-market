-- Allow meet_broadcast_session_destinations rows for one-time RTMP (no stream_destinations id)
ALTER TABLE `meet_broadcast_session_destinations` MODIFY COLUMN `stream_destination_id` int NULL;
