import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureCrmTables } from "@/lib/db/crm-ensure";

/**
 * Creates `client_accounts` and adds `clientId` columns used by the Revenue OS Client Hub.
 * Safe to call on every request; uses IF NOT EXISTS / best-effort ALTERs.
 */
export async function ensureClientHubTables() {
  await ensureCrmTables();
  const db = await getDb();

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS client_accounts (
      id VARCHAR(36) PRIMARY KEY,
      ownerUserId INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      workspaceId VARCHAR(64) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      notes TEXT NULL,
      logoUrl TEXT NULL,
      servicesJson TEXT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX client_accounts_owner_idx (ownerUserId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  try {
    await db.execute(sql`ALTER TABLE client_accounts ADD COLUMN logoUrl TEXT NULL`);
  } catch {
    /* column may exist */
  }
  try {
    await db.execute(sql`ALTER TABLE client_accounts ADD COLUMN servicesJson TEXT NULL`);
  } catch {
    /* column may exist */
  }

  try {
    await db.execute(sql`ALTER TABLE web3_sites ADD COLUMN clientId VARCHAR(36) NULL, ADD INDEX web3_sites_client_idx (clientId)`);
  } catch {
    /* column or index may exist */
  }
  try {
    await db.execute(sql`ALTER TABLE web3_sites ADD INDEX web3_sites_client_idx (clientId)`);
  } catch {
    /* index may exist */
  }
  try {
    await db.execute(
      sql`ALTER TABLE crm_contacts ADD COLUMN clientId VARCHAR(36) NULL, ADD INDEX idx_crm_contacts_client (clientId)`,
    );
  } catch {
    /* may exist */
  }
  try {
    await db.execute(sql`ALTER TABLE crm_contacts ADD INDEX idx_crm_contacts_client (clientId)`);
  } catch {
    /* */
  }
  try {
    await db.execute(
      sql`ALTER TABLE ai_agent_site_bindings ADD COLUMN clientId VARCHAR(36) NULL, ADD INDEX ai_agent_site_bindings_client_idx (clientId)`,
    );
  } catch {
    /* */
  }
  try {
    await db.execute(sql`ALTER TABLE ai_agent_site_bindings ADD INDEX ai_agent_site_bindings_client_idx (clientId)`);
  } catch {
    /* */
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS client_hub_automation_events (
      id VARCHAR(36) PRIMARY KEY,
      userId INT NOT NULL,
      clientId VARCHAR(36) NOT NULL,
      eventType VARCHAR(64) NOT NULL,
      refId VARCHAR(36) NULL,
      metadata JSON NULL,
      createdAt TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
      INDEX idx_chae_client_created (clientId, createdAt),
      INDEX idx_chae_user_client (userId, clientId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}
