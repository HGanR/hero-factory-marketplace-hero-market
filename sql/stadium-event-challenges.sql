-- Additive only. Apply explicitly before enabling paid events; never run DDL on public requests.
CREATE TABLE IF NOT EXISTS stadium_event_challenges (
 id char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 wallet char(42) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 eventId varchar(64) NOT NULL,
 policyHash char(64) NOT NULL,
 message text NOT NULL,
 expiresAt bigint NOT NULL,
 KEY stadium_challenge_expiry (expiresAt),
 KEY stadium_challenge_wallet (wallet, expiresAt)
);
