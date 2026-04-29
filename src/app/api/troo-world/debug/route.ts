/**
 * GET /api/troo-world/debug
 * Returns safe diagnostic info to help troubleshoot "Failed to save placements".
 * No auth required — only returns non-sensitive status.
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { trooWorlds, trooWorldPlacements } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const DEFAULT_WORLD_ID = "default";

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    databaseUrlLength: process.env.DATABASE_URL?.length ?? 0,
    vercelEnv: process.env.VERCEL_ENV ?? "local",
  };

  try {
    const db = await getDb();
    diagnostics.dbConnected = true;

    const worlds = await db.select({ id: trooWorlds.id }).from(trooWorlds).where(eq(trooWorlds.id, DEFAULT_WORLD_ID)).limit(1);
    diagnostics.tablesExist = true;
    diagnostics.defaultWorldExists = worlds.length > 0;

    if (worlds.length > 0) {
      const placements = await db
        .select({ elementKey: trooWorldPlacements.elementKey, posX: trooWorldPlacements.posX, posZ: trooWorldPlacements.posZ })
        .from(trooWorldPlacements)
        .where(eq(trooWorldPlacements.worldId, DEFAULT_WORLD_ID));
      diagnostics.placementCount = placements.length;
    }
  } catch (e) {
    diagnostics.dbConnected = false;
    diagnostics.dbError = e instanceof Error ? e.message : "Unknown error";
  }

  return NextResponse.json(diagnostics);
}
