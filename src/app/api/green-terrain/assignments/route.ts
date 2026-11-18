import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { oasisNpcs, trooWorldPlacements } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
export const dynamic = "force-dynamic";
const validId = (x: unknown): x is string => typeof x === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(x);
/** Public listings expose only published, still-valid world-scoped NPC assignments. */
export async function GET(request: NextRequest) {
  const worldId = request.nextUrl.searchParams.get("worldId");
  if (!validId(worldId)) return NextResponse.json({ error: "Invalid world" }, { status: 400 });
  try {
    const db = await getDb();
    const result = await db.execute(sql`SELECT building_id AS buildingId, agent_id AS agentId
      FROM green_terrain_agent_assignments
      WHERE world_id = ${worldId} AND source = 'npc' AND status = 'published'`);
    const rows = result[0] as unknown as Array<{ buildingId: string; agentId: string }>;
    const assignments = [];
    for (const row of rows) {
      const [building] = await db.select({ id: trooWorldPlacements.id }).from(trooWorldPlacements)
        .where(and(eq(trooWorldPlacements.worldId, worldId), eq(trooWorldPlacements.elementKey, row.buildingId))).limit(1);
      if (!building) continue;
      const [npc] = await db.select({
        npcId: oasisNpcs.npcId, name: oasisNpcs.name, title: oasisNpcs.title,
        role: oasisNpcs.role, avatarEmoji: oasisNpcs.avatarEmoji,
      }).from(oasisNpcs)
        .where(and(eq(oasisNpcs.npcId, row.agentId), eq(oasisNpcs.worldId, worldId), eq(oasisNpcs.isActive, true))).limit(1);
      if (npc) assignments.push({ worldId, buildingId: row.buildingId, agent: npc, status: "published" });
    }
    return NextResponse.json({ worldId, assignments }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[green-terrain public assignments]", error);
    return NextResponse.json({ error: "Property listings unavailable" }, { status: 503 });
  }
}
