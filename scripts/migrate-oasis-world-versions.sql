-- OASIS World Versions + Events (Spell-like AI generation pipeline)
-- Run: mysql $DATABASE_URL < scripts/migrate-oasis-world-versions.sql

CREATE TABLE IF NOT EXISTS oasis_world_versions (
  id VARCHAR(64) PRIMARY KEY,
  worldId VARCHAR(64) NOT NULL,
  sceneGraph TEXT NOT NULL,
  seed INT NOT NULL DEFAULT 0,
  readinessHash VARCHAR(64) NULL,
  createdByUserId INT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX oasis_world_versions_world_idx (worldId),
  INDEX oasis_world_versions_created_at_idx (createdAt)
);

CREATE TABLE IF NOT EXISTS oasis_world_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  worldId VARCHAR(64) NOT NULL,
  eventType VARCHAR(64) NOT NULL,
  payload TEXT NULL,
  createdByUserId INT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX oasis_world_events_world_idx (worldId),
  INDEX oasis_world_events_created_at_idx (createdAt)
);
