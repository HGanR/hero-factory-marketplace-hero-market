/**
 * Raw SQL helpers for worlds API — avoids Drizzle schema mismatch with TiDB
 * when optional columns (ownerWallet, nftContractAddress, etc.) may not exist.
 */
import { sql } from "drizzle-orm";

export type WorldRow = {
  id: string;
  ownerId: number;
  name: string;
  description: string | null;
  visibility: string;
  terrainSeed: number;
  biomeType: string;
  status: string;
};

export async function getWorldById(db: { execute: (q: ReturnType<typeof sql>) => Promise<unknown> }, worldId: string): Promise<WorldRow | null> {
  const [rows] = (await db.execute(
    sql`SELECT id, ownerId, name, description, visibility, terrainSeed, biomeType, status FROM worlds WHERE id = ${worldId} LIMIT 1`
  )) as any;
  const row = Array.isArray(rows) ? rows[0] : rows?.rows?.[0] ?? rows;
  return row ?? null;
}
