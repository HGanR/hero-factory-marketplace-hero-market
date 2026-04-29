import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db";

export async function ensureAgentArchitectureMapsTable(
  db: Awaited<ReturnType<typeof getDb>>
) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agent_architecture_maps (
      id VARCHAR(64) PRIMARY KEY,
      userId INT NOT NULL,
      workspaceId VARCHAR(64) NOT NULL,
      consultantId VARCHAR(36),
      title VARCHAR(255) NOT NULL,
      nodesJson TEXT NOT NULL,
      edgesJson TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX agent_arch_maps_workspace_idx (workspaceId),
      INDEX agent_arch_maps_user_idx (userId)
    )
  `);
}

export async function ensureAgentWebhookRegistrationsTable(
  db: Awaited<ReturnType<typeof getDb>>
) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agent_webhook_registrations (
      webhookKey VARCHAR(64) PRIMARY KEY,
      userId INT NOT NULL,
      workspaceId VARCHAR(64) NOT NULL,
      triggerNodeId VARCHAR(64) NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX agent_webhook_workspace_idx (workspaceId)
    )
  `);
}
