import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db";

export async function ensureEntityMapsTable(db: Awaited<ReturnType<typeof getDb>>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS entity_maps (
      id VARCHAR(64) PRIMARY KEY,
      userId INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      nodesJson TEXT NOT NULL,
      edgesJson TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX entity_maps_user_idx (userId),
      INDEX entity_maps_updated_idx (updatedAt)
    )
  `);
}
