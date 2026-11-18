import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { oasisNpcs, oasisNpcSessions, trooWorldPlacements } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { POST as npcChatPost } from "@/app/api/troo-world/npc-chat/route";

export const dynamic = "force-dynamic";
const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value);

/** Property-sign chat: validate the published building-to-NPC binding on every message. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { worldId, buildingId, message, sessionId } = body;
  if (!validId(worldId) || !validId(buildingId) ||
      typeof message !== "string" || !message.trim() || message.length > 4000 ||
      (sessionId != null && (typeof sessionId !== "string" || sessionId.length > 128))) {
    return NextResponse.json({ error: "Invalid property chat request" }, { status: 400 });
  }
  try {
    const db = await getDb();
    const [building] = await db.select({ id: trooWorldPlacements.id })
      .from(trooWorldPlacements)
      .where(and(eq(trooWorldPlacements.worldId, worldId), eq(trooWorldPlacements.elementKey, buildingId)))
      .limit(1);
    if (!building) return NextResponse.json({ error: "Property not available" }, { status: 404 });

    const result = await db.execute(sql`SELECT agent_id AS agentId FROM green_terrain_agent_assignments
      WHERE world_id = ${worldId} AND building_id = ${buildingId}
      AND source = 'npc' AND status = 'published' LIMIT 1`);
    const rows = result[0] as unknown as Array<{ agentId: string }>;
    const agentId = rows[0]?.agentId;
    if (!agentId) return NextResponse.json({ error: "Property not listed" }, { status: 404 });

    const [npc] = await db.select({ npcId: oasisNpcs.npcId })
      .from(oasisNpcs)
      .where(and(eq(oasisNpcs.npcId, agentId), eq(oasisNpcs.worldId, worldId), eq(oasisNpcs.isActive, true)))
      .limit(1);
    if (!npc) return NextResponse.json({ error: "Property agent unavailable" }, { status: 404 });

    // Never reuse a chat session owned by a different NPC.
    if (sessionId) {
      const [session] = await db.select({ npcNpcId: oasisNpcSessions.npcNpcId })
        .from(oasisNpcSessions).where(eq(oasisNpcSessions.sessionId, sessionId)).limit(1);
      if (!session || session.npcNpcId !== agentId) {
        return NextResponse.json({ error: "Invalid property chat session" }, { status: 403 });
      }
    }

    const forwarded = new NextRequest(request.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ npcId: agentId, message: message.trim(), sessionId }),
    });
    return npcChatPost(forwarded);
  } catch (error) {
    console.error("[green-terrain property chat]", error);
    return NextResponse.json({ error: "Property chat unavailable" }, { status: 503 });
  }
}
