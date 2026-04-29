CREATE TABLE IF NOT EXISTS meeting_node_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event VARCHAR(64) NOT NULL,
  nodeId VARCHAR(36),
  roomId VARCHAR(80),
  worldId VARCHAR(64),
  payload TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX meeting_node_events_event_idx (event),
  INDEX meeting_node_events_node_idx (nodeId),
  INDEX meeting_node_events_created_idx (createdAt)
);

CREATE TABLE IF NOT EXISTS avatar_profiles (
  id VARCHAR(36) PRIMARY KEY,
  userId INT NOT NULL,
  displayName VARCHAR(120),
  avatarModelUrl VARCHAR(512) NOT NULL,
  thumbnailUrl VARCHAR(512),
  configJson TEXT,
  sourceType ENUM('preset', 'uploaded', 'generated') DEFAULT 'preset' NOT NULL,
  version INT DEFAULT 1 NOT NULL,
  isDefault BOOLEAN DEFAULT FALSE NOT NULL,
  status ENUM('draft', 'ready') DEFAULT 'ready' NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX avatar_profiles_user_idx (userId),
  INDEX avatar_profiles_default_idx (userId, isDefault)
);

CREATE TABLE IF NOT EXISTS meeting_invites (
  id VARCHAR(36) PRIMARY KEY,
  meetingNodeId VARCHAR(36) NOT NULL,
  invitedByUserId INT NOT NULL,
  inviteeUserId INT,
  inviteeEmail VARCHAR(320),
  inviteeWallet VARCHAR(42),
  inviteToken VARCHAR(64) NOT NULL,
  status ENUM('pending', 'accepted', 'revoked', 'expired') DEFAULT 'pending' NOT NULL,
  expiresAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX meeting_invites_node_idx (meetingNodeId),
  UNIQUE INDEX meeting_invites_token_uidx (inviteToken),
  INDEX meeting_invites_status_idx (status)
);
