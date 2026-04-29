CREATE TABLE IF NOT EXISTS site_activity_events (
  id VARCHAR(36) PRIMARY KEY,
  clientId VARCHAR(36) NOT NULL,
  siteId VARCHAR(36) NULL,
  agentId VARCHAR(36) NULL,
  type VARCHAR(24) NOT NULL,
  metadataJson JSON NULL,
  createdAt TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
  INDEX idx_site_activity_client_created (clientId, createdAt),
  INDEX idx_site_activity_type_created (type, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_activity_events (
  id VARCHAR(36) PRIMARY KEY,
  clientId VARCHAR(36) NOT NULL,
  agentId VARCHAR(36) NOT NULL,
  type VARCHAR(24) NOT NULL,
  createdAt TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
  INDEX idx_agent_activity_client_created (clientId, createdAt),
  INDEX idx_agent_activity_agent_created (agentId, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS crm_event_log (
  id VARCHAR(36) PRIMARY KEY,
  clientId VARCHAR(36) NOT NULL,
  contactId VARCHAR(36) NULL,
  conversationId VARCHAR(36) NULL,
  type VARCHAR(24) NOT NULL,
  metadataJson JSON NULL,
  createdAt TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
  INDEX idx_crm_event_client_created (clientId, createdAt),
  INDEX idx_crm_event_type_created (type, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
