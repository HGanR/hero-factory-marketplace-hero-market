import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db";

export async function ensureTrademarkTables(db: Awaited<ReturnType<typeof getDb>>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS trademark_projects (
      id VARCHAR(64) PRIMARY KEY,
      userId INT NOT NULL,
      clientId INT NULL,
      workspaceId VARCHAR(128) NULL,
      title VARCHAR(255) NOT NULL,
      markType ENUM('standard','special','sound') NOT NULL DEFAULT 'standard',
      status ENUM('draft','ready','review') NOT NULL DEFAULT 'draft',
      payloadJson TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX trademark_projects_user_idx (userId),
      INDEX trademark_projects_status_idx (status),
      INDEX trademark_projects_updated_idx (updatedAt)
    )
  `);
}
