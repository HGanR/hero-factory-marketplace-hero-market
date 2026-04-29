/**
 * GET /api/troo-world/placements
 * Returns placements for the active/default Troo World (public, for user-facing troo-world page).
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trooWorlds, trooWorldPlacements } from "@/lib/db/schema";

const DEFAULT_WORLD_ID = "default";

async function ensureDefaultWorld(db: Awaited<ReturnType<typeof getDb>>) {
  const existing = await db.select({ id: trooWorlds.id }).from(trooWorlds).where(eq(trooWorlds.id, DEFAULT_WORLD_ID)).limit(1);
  if (existing.length > 0) {
    // Default world exists — ensure Stadium Elyseum is present (for existing deployments)
    const [stadium] = await db
      .select()
      .from(trooWorldPlacements)
      .where(and(eq(trooWorldPlacements.worldId, DEFAULT_WORLD_ID), eq(trooWorldPlacements.elementKey, "stadium-elyseum")))
      .limit(1);
    if (!stadium) {
      await db.insert(trooWorldPlacements).values({
        worldId: DEFAULT_WORLD_ID,
        elementKey: "stadium-elyseum",
        glbUrl: "/models/world-assets/stadium-elyseum.glb",
        posX: "0",
        posY: "0",
        posZ: "60",
        scale: "1",
        rotY: "0",
      });
    }
    return;
  }

  await db.insert(trooWorlds).values({
    id: DEFAULT_WORLD_ID,
    name: "Troo World",
    slug: "troo-world",
    isDefault: true,
    isPublished: true,
  });

  await db.insert(trooWorldPlacements).values([
    { worldId: DEFAULT_WORLD_ID, elementKey: "nexus-tower", glbUrl: "/models/nexus-tower/modern_building.glb", posX: "-35", posY: "0", posZ: "0", scale: "1", rotY: "0" },
    { worldId: DEFAULT_WORLD_ID, elementKey: "meridian-tower", glbUrl: "/models/meridian-tower/meridian_tower.glb", posX: "35", posY: "0", posZ: "0", scale: "1", rotY: "0" },
    { worldId: DEFAULT_WORLD_ID, elementKey: "apex-tower", glbUrl: "procedural:apex", posX: "0", posY: "0", posZ: "0", scale: "1", rotY: "0" },
    { worldId: DEFAULT_WORLD_ID, elementKey: "harborview-tower", glbUrl: "procedural:harborview", posX: "-55", posY: "0", posZ: "-55", scale: "1", rotY: "0" },
    { worldId: DEFAULT_WORLD_ID, elementKey: "stadium-elyseum", glbUrl: "/models/world-assets/stadium-elyseum.glb", posX: "0", posY: "0", posZ: "60", scale: "1", rotY: "0" },
  ]);
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const worldId = request.nextUrl.searchParams.get("worldId") ?? DEFAULT_WORLD_ID;

    await ensureDefaultWorld(db);

    const worlds = await db.select().from(trooWorlds).where(eq(trooWorlds.id, worldId)).limit(1);
    const activeWorld = worlds[0] ?? (await db.select().from(trooWorlds).where(eq(trooWorlds.isDefault, true)).limit(1)).at(0);
    const wid = activeWorld?.id ?? DEFAULT_WORLD_ID;

    const placements = await db
      .select()
      .from(trooWorldPlacements)
      .where(eq(trooWorldPlacements.worldId, wid));

    return NextResponse.json({
      worldId: wid,
      worldName: activeWorld?.name ?? "Troo World",
      placements: placements.map((p) => ({
        id: p.id,
        elementKey: p.elementKey,
        glbUrl: p.glbUrl,
        posX: Number(p.posX),
        posY: Number(p.posY),
        posZ: Number(p.posZ),
        scale: Number(p.scale),
        rotY: Number(p.rotY),
      })),
    });
  } catch (e) {
    console.error("[troo-world placements]", e);
    return NextResponse.json({ error: "Failed to load placements" }, { status: 500 });
  }
}
