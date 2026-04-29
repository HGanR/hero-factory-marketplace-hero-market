-- RET intake sessions (authoritative draft for widget when retSessionId is sent)
CREATE TABLE IF NOT EXISTS `ret_sessions` (
  `id` varchar(36) NOT NULL,
  `userId` int NOT NULL,
  `draftJson` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ret_sessions_user_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
