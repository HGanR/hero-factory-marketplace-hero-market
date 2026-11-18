import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { oasisNpcs, trooWorldPlacements } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
export const dynamic = "force-dynamic";
const validId = (x: unknown): x is string => typeof x === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(x);
const isAdmin = (r: NextRequest) => {
  const token = r.cookies.get("admin-token")?.value || r.cookies.get("auth-token")?.value;
  return !!token && verifyToken(token)?.isAdmin === true;
};
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Administrator required" }, { status: 403 });
  const worldId = request.nextUrl.searchParams.get("worldId");
  const buildingId = request.nextUrl.searchParams.get("buildingId");
  if (!validId(worldId) || !validId(buildingId)) return NextResponse.json({ error: "Invalid identifiers" }, { status: 400 });
  try {
    const db = await getDb();
    const result = await db.execute(sql`SELECT world_id AS worldId, building_id AS buildingId, agent_id AS agentId, source, status FROM green_terrain_agent_assignments WHERE world_id = ${worldId} AND building_id = ${buildingId} LIMIT 1`);
    return NextResponse.json({ assignment: (result[0] as unknown as Record<string, unknown>[])[0] ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[green-terrain assignments GET]", error);
    return NextResponse.json({ error: "Assignment storage unavailable" }, { status: 503 });
  }
}
export async function PUT(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Administrator required" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { worldId, buildingId, agentId, source, status } = body;
  if (!validId(worldId) || !validId(buildingId) || !validId(agentId) || source !== "npc" || (status !== "published" && status !== "unlisted")) return NextResponse.json({ error: "Invalid assignment" }, { status: 400 });
  try {
    const db = await getDb();
    const building = await db.select({ id: trooWorldPlacements.id }).from(trooWorldPlacements).where(and(eq(trooWorldPlacements.worldId, worldId), eq(trooWorldPlacements.elementKey, buildingId))).limit(1);
    if (!building.length) return NextResponse.json({ error: "Building not found in world" }, { status: 422 });
    const npc = await db.select({ id: oasisNpcs.id }).from(oasisNpcs).where(and(eq(oasisNpcs.npcId, agentId), eq(oasisNpcs.worldId, worldId), eq(oasisNpcs.isActive, true))).limit(1);
    if (!npc.length) return NextResponse.json({ error: "Agent not active in world" }, { status: 422 });
    await db.execute(sql`INSERT INTO green_terrain_agent_assignments (world_id, building_id, source, agent_id, status) VALUES (${worldId}, ${buildingId}, 'npc', ${agentId}, ${status}) ON DUPLICATE KEY UPDATE source = VALUES(source), agent_id = VALUES(agent_id), status = VALUES(status)`);
    return NextResponse.json({ ok: true, worldId, buildingId, status });
  } catch (error) {
    console.error("[green-terrain assignments PUT]", error);
    return NextResponse.json({ error: "Assignment storage unavailable" }, { status: 503 });
  }
}
