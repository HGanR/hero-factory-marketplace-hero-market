/**
 * GET /api/worlds/me — List worlds owned by the current user
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { worlds } from "@/lib/db/schema.worlds";
import { getAuthedUserId } from "@/lib/api/auth";

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getDb();
    const myWorlds = await db
      .select()
      .from(worlds)
      .where(eq(worlds.ownerId, userId))
      .orderBy(desc(worlds.updatedAt));

    return NextResponse.json({
      worlds: myWorlds.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        visibility: w.visibility,
        terrainSeed: w.terrainSeed,
        biomeType: w.biomeType,
        status: w.status,
        createdAt: w.createdAt?.toISOString(),
        updatedAt: w.updatedAt?.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[api/worlds/me GET]", e);
    return NextResponse.json({ error: "Failed to load worlds" }, { status: 500 });
  }
}
