/**
 * Public API to fetch NPCs for Troo Town / Green Terrain world.
 * GET: List NPCs filtered by worldId, buildingId, and/or floor
 *
 * Query params:
 *   - worldId: Filter by world (e.g., "green-terrain")
 *   - buildingId: Filter by building (e.g., "nexus-corporate-tower")
 *   - floor: Filter by floor number (0-4)
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { oasisNpcs } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { seedDefaultNpcs } from "@/lib/npc/db";

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const worldId = searchParams.get("worldId");
    const buildingId = searchParams.get("buildingId");
    const floor = searchParams.get("floor");

    // Ensure NPCs are seeded
    await seedDefaultNpcs();

    // Build query conditions
    const conditions = [eq(oasisNpcs.isActive, true)];

    if (worldId) {
      conditions.push(eq(oasisNpcs.worldId, worldId));
    }
    if (buildingId) {
      conditions.push(eq(oasisNpcs.buildingId, buildingId));
    }
    if (floor !== null && floor !== undefined && floor !== "") {
      conditions.push(eq(oasisNpcs.floor, parseInt(floor, 10)));
    }

    const npcs = await db
      .select({
        id: oasisNpcs.npcId,
        name: oasisNpcs.name,
        role: oasisNpcs.role,
        title: oasisNpcs.title,
        avatarEmoji: oasisNpcs.avatarEmoji,
        greeting: oasisNpcs.greeting,
        worldId: oasisNpcs.worldId,
        buildingId: oasisNpcs.buildingId,
        floor: oasisNpcs.floor,
        voiceStyle: oasisNpcs.voiceStyle,
        personalityJson: oasisNpcs.personalityJson,
      })
      .from(oasisNpcs)
      .where(and(...conditions))
      .orderBy(asc(oasisNpcs.floor), asc(oasisNpcs.name));

    // Parse personality JSON and add department/expertise if available
    const formattedNpcs = npcs.map((npc) => {
      let personality: { department?: string; expertise?: string } = {};
      if (npc.personalityJson) {
        try {
          personality = JSON.parse(npc.personalityJson);
        } catch {
          // ignore parse errors
        }
      }

      // Map floor number to label (10 floors: Lobby + 9 financial disciplines)
      const floorLabels: Record<number, string> = {
        0: "Lobby",
        1: "Floor 1 — Currency",
        2: "Floor 2 — Finance",
        3: "Floor 3 — Transfer",
        4: "Floor 4 — Broker",
        5: "Floor 5 — Compliance",
        6: "Floor 6 — Trustee",
        7: "Floor 7 — Custodian",
        8: "Floor 8 — Clearing",
        9: "Floor 9 — Architect",
      };

      return {
        id: npc.id,
        name: npc.name,
        role: npc.role,
        title: npc.title,
        avatar: npc.avatarEmoji,
        avatarEmoji: npc.avatarEmoji,
        greeting: npc.greeting,
        floor: npc.floor,
        floorLabel: npc.floor !== null ? (floorLabels[npc.floor] || `Floor ${npc.floor}`) : null,
        department: personality.department || null,
        expertise: personality.expertise || null,
        worldId: npc.worldId,
        buildingId: npc.buildingId,
      };
    });

    return NextResponse.json({ npcs: formattedNpcs });
  } catch (error) {
    console.error("GET /api/troo-world/npcs error:", error);
    return NextResponse.json({ error: "Failed to fetch NPCs" }, { status: 500 });
  }
}
