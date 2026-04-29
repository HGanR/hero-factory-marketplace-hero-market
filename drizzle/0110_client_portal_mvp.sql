-- Client Portal MVP: portal users, invites, service status, activity (operator-owned clients).
-- Runtime ensure: `src/lib/db/client-portal-ensure.ts`

CREATE TABLE IF NOT EXISTS client_portal_users (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  clientId VARCHAR(36) NOT NULL,
  ownerUserId INT NOT NULL,
  email VARCHAR(320) NOT NULL,
  name VARCHAR(255) NULL,
  passwordHash VARCHAR(255) NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'viewer',
  status VARCHAR(16) NOT NULL DEFAULT 'invited',
  lastLoginAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  UNIQUE KEY uq_cportal_user_client_email (clientId, email(191)),
  INDEX idx_cportal_users_client (clientId),
  INDEX idx_cportal_users_owner (ownerUserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS client_portal_invites (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  clientId VARCHAR(36) NOT NULL,
  ownerUserId INT NOT NULL,
  email VARCHAR(320) NOT NULL,
  tokenHash VARCHAR(64) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'manager',
  expiresAt TIMESTAMP NOT NULL,
  acceptedAt TIMESTAMP NULL,
  revokedAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX idx_cportal_invites_client (clientId),
  INDEX idx_cportal_invites_token (tokenHash),
  INDEX idx_cportal_invites_email (email(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS client_service_status (
  clientId VARCHAR(36) NOT NULL PRIMARY KEY,
  ownerUserId INT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  pauseReason VARCHAR(512) NULL,
  pausedAt TIMESTAMP NULL,
  resumedAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX idx_css_owner (ownerUserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS client_portal_activity_log (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  clientId VARCHAR(36) NOT NULL,
  portalUserId VARCHAR(36) NULL,
  action VARCHAR(64) NOT NULL,
  payloadJson JSON NULL,
  createdAt TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
  INDEX idx_cpact_client_created (clientId, createdAt),
  INDEX idx_cpact_portal (portalUserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
