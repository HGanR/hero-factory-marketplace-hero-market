import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db";

const ALTERS = [
  "ALTER TABLE oasis_world_elements ADD COLUMN assetBounds TEXT",
  "ALTER TABLE oasis_world_elements ADD COLUMN defaultScale DECIMAL(8,4)",
  "ALTER TABLE oasis_world_elements ADD COLUMN colliderType VARCHAR(24)",
  "ALTER TABLE oasis_world_elements ADD COLUMN resolvedUrl VARCHAR(1024)",
  "ALTER TABLE oasis_world_elements ADD COLUMN resolvedUrlUpdatedAt TIMESTAMP NULL",
  "ALTER TABLE oasis_world_elements ADD COLUMN isReady BOOLEAN DEFAULT TRUE",
  "ALTER TABLE oasis_world_elements ADD COLUMN lastVerifiedAt TIMESTAMP NULL",
  "ALTER TABLE oasis_world_elements ADD COLUMN lastError VARCHAR(512) NULL",
];

export async function ensureOasisAssetColumns(db: Awaited<ReturnType<typeof getDb>>) {
  for (const stmt of ALTERS) {
    try {
      await db.execute(sql.raw(stmt));
    } catch {
      // Column already exists
    }
  }
}
