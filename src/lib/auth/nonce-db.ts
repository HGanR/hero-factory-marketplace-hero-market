import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db";

export async function ensureAuthNoncesTable(db: Awaited<ReturnType<typeof getDb>>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS auth_nonces (
      walletAddress VARCHAR(42) PRIMARY KEY,
      nonce VARCHAR(64) NOT NULL,
      expiresAt TIMESTAMP NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
