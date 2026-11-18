-- Apply in a reviewed staging environment before testing assignment writes.
-- Production migration requires separate approval.
CREATE TABLE IF NOT EXISTS green_terrain_agent_assignments (
  world_id VARCHAR(128) NOT NULL,
  building_id VARCHAR(128) NOT NULL,
  source ENUM('npc', 'ai-agency') NOT NULL,
  agent_id VARCHAR(128) NOT NULL,
  status ENUM('published', 'unlisted') NOT NULL DEFAULT 'unlisted',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (world_id, building_id)
);
