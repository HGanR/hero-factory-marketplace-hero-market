/**
 * Admin API for Troo World placements.
 * GET: list placements (with world list)
 * PUT: update placements for a world
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trooWorlds, trooWorldPlacements, meetingNodePlacements, meetingInvites } from "@/lib/db/schema";
import { engineRouteActor, requireSameOrigin, EngineAccessError } from "@/lib/security/engine-route-access";

export const dynamic = "force-dynamic";
const DEFAULT_WORLD_ID = "default";

async function requireWorldAdmin(request: NextRequest) {
  const actor = await engineRouteActor(request);
  // These are platform troo_worlds, not member-owned worlds.ownerId records.
  if (!actor.admin) throw new EngineAccessError("Administrator access required", 403);
}

async function ensureDefaultWorld(db: Awaited<ReturnType<typeof getDb>>) {
  const existing = await db.select({ id: trooWorlds.id }).from(trooWorlds).where(eq(trooWorlds.id, DEFAULT_WORLD_ID)).limit(1);
  if (existing.length > 0) return;

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
    await requireWorldAdmin(request);
    const db = await getDb();
    const worldId = request.nextUrl.searchParams.get("worldId") ?? DEFAULT_WORLD_ID;

    await ensureDefaultWorld(db);

    const worlds = await db.select().from(trooWorlds);
    const placements = await db
      .select()
      .from(trooWorldPlacements)
      .where(eq(trooWorldPlacements.worldId, worldId));

    return NextResponse.json({
      worlds: worlds.map((w) => ({ id: w.id, name: w.name, slug: w.slug, isDefault: w.isDefault, isPublished: w.isPublished })),
      worldId,
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
  } catch (e: unknown) {
    if (e instanceof EngineAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin troo-world placements]", e);
    return NextResponse.json({ error: "Failed to load placements" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireWorldAdmin(request);
    requireSameOrigin(request);
    const db = await getDb();
    const body = await request.json();
    const { worldId = DEFAULT_WORLD_ID, placements, replace } = body as {
      worldId?: string;
      replace?: boolean;
      placements: Array<{
        elementKey: string;
        glbUrl: string;
        posX: number;
        posY: number;
        posZ: number;
        scale?: number;
        rotY?: number;
      }>;
    };

    if (!Array.isArray(placements)) {
      return NextResponse.json({ error: "placements must be an array" }, { status: 400 });
    }

    await ensureDefaultWorld(db);

    if (replace) {
      const elementKeys = placements.map((p) => p.elementKey).filter(Boolean);
      const existing = await db.select({ id: trooWorldPlacements.id, elementKey: trooWorldPlacements.elementKey }).from(trooWorldPlacements).where(eq(trooWorldPlacements.worldId, worldId));
      const toDelete = existing.filter((e) => !elementKeys.includes(e.elementKey)).map((e) => e.id);
      if (toDelete.length > 0) {
        // meeting_node_placements may not exist (no migration creates it) — cleanup is optional
        try {
          const parentPlacementIn = sql`parentPlacementId IN (${sql.join(toDelete.map((id) => sql`${id}`), sql`, `)})`;
          const nodesToRemove = await db
            .select({ id: meetingNodePlacements.id })
            .from(meetingNodePlacements)
            .where(parentPlacementIn);
          const nodeIds = nodesToRemove.map((n) => n.id);
          if (nodeIds.length > 0) {
            const meetingNodeIn = sql`meetingNodeId IN (${sql.join(nodeIds.map((id) => sql`${id}`), sql`, `)})`;
            await db.delete(meetingInvites).where(meetingNodeIn);
          }
          await db.delete(meetingNodePlacements).where(parentPlacementIn);
        } catch (meetingErr) {
          // meeting_node_placements / meeting_invites may not exist — continue with placement deletes
          console.warn("[admin troo-world placements] Meeting node cleanup skipped:", meetingErr instanceof Error ? meetingErr.message : meetingErr);
        }
        for (const id of toDelete) {
          await db.delete(trooWorldPlacements).where(eq(trooWorldPlacements.id, id));
        }
      }
    }

    for (const p of placements) {
      const existing = await db
        .select({ id: trooWorldPlacements.id })
        .from(trooWorldPlacements)
        .where(and(eq(trooWorldPlacements.worldId, worldId), eq(trooWorldPlacements.elementKey, p.elementKey)))
        .limit(1);

      const row = {
        worldId,
        elementKey: p.elementKey,
        glbUrl: String(p.glbUrl ?? ""),
        posX: String(Number(p.posX) || 0),
        posY: String(Number(p.posY) || 0),
        posZ: String(Number(p.posZ) || 0),
        scale: String(Number(p.scale) ?? 1),
        rotY: String(Number(p.rotY) ?? 0),
      };

      if (existing.length > 0) {
        await db
          .update(trooWorldPlacements)
          .set({ ...row, updatedAt: new Date() })
          .where(eq(trooWorldPlacements.id, existing[0].id));
      } else {
        await db.insert(trooWorldPlacements).values(row);
      }
    }

    return NextResponse.json({ success: true, message: "Placements saved" });
  } catch (e: unknown) {
    if (e instanceof EngineAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin troo-world PUT]", e);
    // Return actual error so client can show it (e.g. DB connection, table missing)
    return NextResponse.json(
      { error: "Failed to save placements" },
      { status: 500 }
    );
  }
}

