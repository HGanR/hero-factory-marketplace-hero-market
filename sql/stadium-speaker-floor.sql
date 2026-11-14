-- Additive event floor control. Apply only to the approved target database.
CREATE TABLE IF NOT EXISTS troo_stadium_floor (
 scope varchar(48) NOT NULL, roomKey char(64) NOT NULL,
 hostIdentity varchar(80) NOT NULL, hostSeatIndex smallint unsigned NOT NULL,
 speakerIdentity varchar(80) NULL, turnId char(64) NULL,
 invitedIdentity varchar(80) NULL, inviteId char(64) NULL, inviteExpiresAt bigint NOT NULL DEFAULT 0,
 revision bigint unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY(scope,roomKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
