import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";

/**
 * Idempotent: creates client portal + service status tables. Safe to call on every request.
 */
export async function ensureClientPortalTables() {
  await ensureClientHubTables();
  const db = await getDb();

  await db.execute(sql`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(sql`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(sql`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS client_portal_activity_log (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      clientId VARCHAR(36) NOT NULL,
      portalUserId VARCHAR(36) NULL,
      action VARCHAR(64) NOT NULL,
      payloadJson JSON NULL,
      createdAt TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
      INDEX idx_cpact_client_created (clientId, createdAt),
      INDEX idx_cpact_portal (portalUserId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS client_portal_requests (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      clientId VARCHAR(36) NOT NULL,
      portalUserId VARCHAR(36) NULL,
      ownerUserId INT NOT NULL,
      type VARCHAR(32) NOT NULL DEFAULT 'other',
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      relatedConversationId VARCHAR(36) NULL,
      relatedAgentId VARCHAR(36) NULL,
      relatedSiteId VARCHAR(36) NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'open',
      operatorNote TEXT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_cpr_client_created (clientId, createdAt),
      INDEX idx_cpr_owner_status (ownerUserId, status),
      INDEX idx_cpr_agent (relatedAgentId),
      INDEX idx_cpr_site (relatedSiteId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}
