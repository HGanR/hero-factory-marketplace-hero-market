/**
 * GET /api/troo-world/placements
 * Returns placements for the active/default Troo World (public, for user-facing troo-world page).
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trooWorlds, trooWorldPlacements } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_WORLD_ID = "default";
const GREEN_TERRAIN_WORLD_ID = "green-terrain";

async function ensureGreenTerrainWorldRecord(db: Awaited<ReturnType<typeof getDb>>) {
  const existing = await db
    .select({ id: trooWorlds.id })
    .from(trooWorlds)
    .where(eq(trooWorlds.id, GREEN_TERRAIN_WORLD_ID))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(trooWorlds).values({
    id: GREEN_TERRAIN_WORLD_ID,
    name: "Troo Town",
    slug: "troo-town",
    isDefault: false,
    isPublished: true,
  });
}

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
    const [veritas] = await db
      .select()
      .from(trooWorldPlacements)
      .where(and(eq(trooWorldPlacements.worldId, DEFAULT_WORLD_ID), eq(trooWorldPlacements.elementKey, "veritas-school")))
      .limit(1);
    if (!veritas) {
      await db.insert(trooWorldPlacements).values({
        worldId: DEFAULT_WORLD_ID,
        elementKey: "veritas-school",
        glbUrl: "procedural:veritas",
        posX: "-55",
        posY: "0",
        posZ: "30",
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
    { worldId: DEFAULT_WORLD_ID, elementKey: "veritas-school", glbUrl: "procedural:veritas", posX: "-55", posY: "0", posZ: "30", scale: "1", rotY: "0" },
  ]);
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    /** Requested bucket — must match PUT worldId from the editor (e.g. green-terrain for /troo-town). */
    const requestedWorldId = request.nextUrl.searchParams.get("worldId") ?? DEFAULT_WORLD_ID;

    await ensureDefaultWorld(db);
    if (requestedWorldId === GREEN_TERRAIN_WORLD_ID) {
      await ensureGreenTerrainWorldRecord(db);
    }

    const worlds = await db.select().from(trooWorlds).where(eq(trooWorlds.id, requestedWorldId)).limit(1);
    const activeWorld = worlds[0] ?? null;
    const wid = requestedWorldId;

    let placements = await db
      .select()
      .from(trooWorldPlacements)
      .where(eq(trooWorldPlacements.worldId, wid));

    /**
     * Legacy: green-terrain editor used to save to `default`. Troo Town reads `green-terrain`.
     * If the green bucket is empty but default has rows, copy once so visitors see the same layout
     * without a manual DB migration (idempotent after first copy).
     */
    if (wid === GREEN_TERRAIN_WORLD_ID && placements.length === 0) {
      const fromDefault = await db
        .select()
        .from(trooWorldPlacements)
        .where(eq(trooWorldPlacements.worldId, DEFAULT_WORLD_ID));
      if (fromDefault.length > 0) {
        try {
          await db.insert(trooWorldPlacements).values(
            fromDefault.map((p) => ({
              worldId: GREEN_TERRAIN_WORLD_ID,
              elementKey: p.elementKey,
              glbUrl: p.glbUrl,
              posX: p.posX,
              posY: p.posY,
              posZ: p.posZ,
              scale: p.scale,
              rotY: p.rotY,
            })),
          );
          placements = await db
            .select()
            .from(trooWorldPlacements)
            .where(eq(trooWorldPlacements.worldId, wid));
        } catch (syncErr) {
          console.warn("[troo-world placements] green-terrain sync from default skipped:", syncErr);
        }
      }
    }

    const worldName =
      activeWorld?.name ??
      (wid === GREEN_TERRAIN_WORLD_ID ? "Troo Town" : wid === DEFAULT_WORLD_ID ? "Troo World" : wid);

    return NextResponse.json(
      {
        worldId: wid,
        worldName,
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
      },
      {
        headers: {
          "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      },
    );
  } catch (e) {
    console.error("[troo-world placements]", e);
    return NextResponse.json({ error: "Failed to load placements" }, { status: 500 });
  }
}
