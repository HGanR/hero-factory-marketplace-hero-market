-- Wreck Room 3D social space tables (run against your MySQL DB if not using drizzle-kit push)
CREATE TABLE IF NOT EXISTS `wreck_rooms` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(128) NOT NULL,
  `description` text,
  `maxUsers` int NOT NULL DEFAULT 20,
  `isPublic` int NOT NULL DEFAULT 1,
  `createdBy` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `wreck_rooms_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `wreck_messages` (
  `id` int AUTO_INCREMENT NOT NULL,
  `roomId` int NOT NULL,
  `userId` int,
  `username` varchar(128) NOT NULL,
  `content` text NOT NULL,
  `type` enum('chat','system','emote') NOT NULL DEFAULT 'chat',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `wreck_messages_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `wreck_room_themes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `roomId` int NOT NULL,
  `lightingColor` varchar(16) DEFAULT '#ff0080',
  `musicGenre` varchar(64) DEFAULT 'Electronic',
  `passwordHash` varchar(256),
  `ambiance` varchar(32) DEFAULT 'club',
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `wreck_room_themes_id` PRIMARY KEY(`id`),
  CONSTRAINT `wreck_room_themes_roomId_unique` UNIQUE(`roomId`)
);

INSERT INTO `wreck_rooms` (`id`, `name`, `description`, `maxUsers`, `isPublic`) VALUES
(1, 'Main Lounge', 'Hang out and chat.', 24, 1),
(2, 'Rooftop', 'Open air vibes.', 16, 1),
(3, 'Game Zone', 'Casual games & banter.', 20, 1),
(4, 'VIP Lounge', 'Members only feel.', 12, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `wreck_room_themes` (`roomId`, `lightingColor`, `musicGenre`, `ambiance`, `passwordHash`) VALUES
(1, '#ff0080', 'Electronic', 'club', NULL),
(2, '#00ffff', 'Lo-Fi', 'outdoor', NULL),
(3, '#00ff88', 'Hip-Hop', 'arcade', NULL),
(4, '#8800ff', 'R&B', 'vip', NULL)
ON DUPLICATE KEY UPDATE `lightingColor` = VALUES(`lightingColor`);
