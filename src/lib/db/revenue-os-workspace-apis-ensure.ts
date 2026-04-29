import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export async function ensureRevenueOsWorkspaceApisTable() {
  const db = await getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS revenue_os_workspace_apis (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      client_id VARCHAR(36) NOT NULL DEFAULT '',
      trust_id VARCHAR(36) NOT NULL DEFAULT '',
      provider VARCHAR(64) NOT NULL,
      label VARCHAR(120),
      api_key_enc TEXT,
      endpoint_url VARCHAR(512),
      cost_acknowledgment_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX revos_api_user_workspace_idx (user_id, client_id, trust_id),
      INDEX revos_api_user_idx (user_id)
    )
  `);
}
