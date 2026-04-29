import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export async function ensureOasisPlacementTables(db?: Awaited<ReturnType<typeof getDb>>) {
  const targetDb = db ?? (await getDb());

  await targetDb.execute(sql`
    CREATE TABLE IF NOT EXISTS oasis_placements (
      id VARCHAR(80) PRIMARY KEY,
      spaceId VARCHAR(80) NOT NULL,
      kind VARCHAR(20),
      elementId INT,
      elementKey VARCHAR(120),
      name VARCHAR(255),
      modelUrl TEXT,
      metadata JSON,
      x DECIMAL(12,4) NOT NULL,
      y DECIMAL(12,4) NOT NULL,
      z DECIMAL(12,4) NOT NULL,
      ry DECIMAL(12,4) NOT NULL,
      scale DECIMAL(12,4) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX oasis_placements_space_idx (spaceId)
    )
  `);
}
