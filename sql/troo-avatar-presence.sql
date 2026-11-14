-- Additive prerequisite. Explicit production approval required before applying.
CREATE TABLE IF NOT EXISTS troo_avatar_assignments (
 scope varchar(48) NOT NULL, avatarId varchar(32) NOT NULL, userId bigint unsigned NOT NULL,
 PRIMARY KEY(scope,avatarId), UNIQUE KEY avatar_per_account(scope,userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS troo_stadium_seats (
 scope varchar(48) NOT NULL, roomKey char(64) NOT NULL, identityKey varchar(80) NOT NULL,
 eventId varchar(64) NOT NULL, policyHash char(64) NOT NULL, seatIndex smallint unsigned NOT NULL,
 nonceHash char(64) NOT NULL, expiresAt bigint NOT NULL,
 PRIMARY KEY(scope,roomKey,identityKey), UNIQUE KEY unique_stadium_seat(scope,roomKey,seatIndex),
 UNIQUE KEY lease_capability(scope,nonceHash), KEY stale_leases(scope,expiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
