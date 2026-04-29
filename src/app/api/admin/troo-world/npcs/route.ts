/**
 * Admin API for Troo World NPCs (AI Agents).
 * GET:    List all NPCs for a world, or all NPCs if no worldId
 * POST:   Create a new NPC
 * PUT:    Update an existing NPC
 * DELETE: Remove an NPC
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { oasisNpcs, oasisNpcKnowledge } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) throw new Error("Unauthorized");
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) throw new Error("Forbidden");
}

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const worldId = searchParams.get("worldId");
    const buildingId = searchParams.get("buildingId");
    const floor = searchParams.get("floor");

    let query = db.select().from(oasisNpcs);

    if (worldId) {
      query = query.where(eq(oasisNpcs.worldId, worldId));
    }
    if (buildingId) {
      query = query.where(eq(oasisNpcs.buildingId, buildingId));
    }
    if (floor !== null && floor !== undefined && floor !== "") {
      query = query.where(eq(oasisNpcs.floor, parseInt(floor, 10)));
    }

    const npcs = await query.orderBy(oasisNpcs.floor, oasisNpcs.name);

    // For each NPC, get their knowledge document count
    const npcIds = npcs.map((n) => n.id);
    let knowledgeCounts: Record<number, number> = {};
    if (npcIds.length > 0) {
      const kResult = await db
        .select({
          npcId: oasisNpcKnowledge.npcId,
          count: sql<number>`COUNT(*)`.as("count"),
        })
        .from(oasisNpcKnowledge)
        .where(sql`${oasisNpcKnowledge.npcId} IN (${sql.join(npcIds.map(id => sql`${id}`), sql`, `)})`)
        .groupBy(oasisNpcKnowledge.npcId);
      knowledgeCounts = Object.fromEntries(kResult.map((r) => [r.npcId, r.count]));
    }

    return NextResponse.json({
      npcs: npcs.map((npc) => ({
        ...npc,
        knowledgeCount: knowledgeCounts[npc.id] || 0,
        personality: npc.personalityJson ? JSON.parse(npc.personalityJson) : null,
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("GET /api/admin/troo-world/npcs error:", error);
    return NextResponse.json({ error: "Failed to fetch NPCs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const db = await getDb();
    const body = await request.json();

    const {
      npcId,
      name,
      role = "secretary",
      title,
      avatarEmoji = "🤖",
      worldId,
      buildingId,
      floor,
      greeting,
      farewell,
      personality,
      voiceStyle = "professional",
      mood = "neutral",
    } = body;

    if (!npcId || !name) {
      return NextResponse.json({ error: "npcId and name are required" }, { status: 400 });
    }

    const personalityJson = personality ? JSON.stringify(personality) : null;

    await db.insert(oasisNpcs).values({
      npcId,
      name,
      role,
      title,
      avatarEmoji,
      worldId,
      buildingId,
      floor,
      greeting,
      farewell,
      personalityJson,
      voiceStyle,
      mood,
      isDefault: false,
      isActive: true,
    });

    return NextResponse.json({ success: true, npcId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("POST /api/admin/troo-world/npcs error:", error);
    return NextResponse.json({ error: "Failed to create NPC" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    requireAdmin(request);
    const db = await getDb();
    const body = await request.json();

    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.avatarEmoji !== undefined) updateData.avatarEmoji = updates.avatarEmoji;
    if (updates.worldId !== undefined) updateData.worldId = updates.worldId;
    if (updates.buildingId !== undefined) updateData.buildingId = updates.buildingId;
    if (updates.floor !== undefined) updateData.floor = updates.floor;
    if (updates.greeting !== undefined) updateData.greeting = updates.greeting;
    if (updates.farewell !== undefined) updateData.farewell = updates.farewell;
    if (updates.voiceStyle !== undefined) updateData.voiceStyle = updates.voiceStyle;
    if (updates.mood !== undefined) updateData.mood = updates.mood;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    if (updates.personality !== undefined) {
      updateData.personalityJson = JSON.stringify(updates.personality);
    }

    await db.update(oasisNpcs).set(updateData).where(eq(oasisNpcs.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("PUT /api/admin/troo-world/npcs error:", error);
    return NextResponse.json({ error: "Failed to update NPC" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    requireAdmin(request);
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const npcId = parseInt(id, 10);

    // Delete knowledge first (foreign key)
    await db.delete(oasisNpcKnowledge).where(eq(oasisNpcKnowledge.npcId, npcId));

    // Delete the NPC
    await db.delete(oasisNpcs).where(eq(oasisNpcs.id, npcId));

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("DELETE /api/admin/troo-world/npcs error:", error);
    return NextResponse.json({ error: "Failed to delete NPC" }, { status: 500 });
  }
}
