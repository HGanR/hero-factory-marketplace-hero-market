/**
 * GET /api/worlds/[worldId]/npcs — NPC placements for world
 * POST /api/worlds/[worldId]/npcs — Add NPC (owner only)
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getAuthedUserId } from "@/lib/api/auth";
import { getWorldById } from "@/lib/api/worlds-helpers";
import crypto from "crypto";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  try {
    const { worldId } = await params;
    const userId = await getAuthedUserId();
    const db = await getDb();

    const world = await getWorldById(db, worldId);
    if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });

    const isOwner = userId !== null && Number(world.ownerId) === userId;
    const isPublic = world.visibility === "public" || world.visibility === "unlisted";
    const isPublished = world.status === "published";

    if (!isOwner && (!isPublic || !isPublished)) {
      return NextResponse.json({ error: "World not found" }, { status: 404 });
    }

    let npcs: Array<{ id: string; agentId: string; buildingId: string | null; placementJson: unknown; role: string | null; voiceProfile: string | null }> = [];
    try {
      const [rows] = (await db.execute(
        sql`SELECT id, agentId, buildingId, placementJson, role, voiceProfile FROM world_npcs WHERE worldId = ${worldId}`
      )) as any;
      const arr = Array.isArray(rows) ? rows : rows?.rows ?? rows ?? [];
      npcs = Array.isArray(arr) ? arr : [arr];
    } catch {
      // world_npcs may not exist
    }

    return NextResponse.json({
      npcs: npcs.map((n) => ({
        id: n.id,
        agentId: n.agentId,
        buildingId: n.buildingId,
        placementJson: n.placementJson,
        role: n.role,
        voiceProfile: n.voiceProfile,
      })),
    });
  } catch (e) {
    console.error("[api/worlds/[worldId]/npcs GET]", e);
    return NextResponse.json({ error: "Failed to load NPCs" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  try {
    const { worldId } = await params;
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { agentId?: string; placementJson?: unknown; role?: string; voiceProfile?: string };
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const agentId = String(body.agentId ?? "default").slice(0, 80);
    const placementJson = body.placementJson ?? { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };

    const db = await getDb();
    const world = await getWorldById(db, worldId);
    if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });
    if (Number(world.ownerId) !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = crypto.randomUUID();
    const role = body.role ?? null;
    const voiceProfile = body.voiceProfile ?? null;
    await db.execute(
      sql`INSERT INTO world_npcs (id, worldId, agentId, buildingId, placementJson, role, voiceProfile) VALUES (${id}, ${worldId}, ${agentId}, ${null}, ${placementJson}, ${role}, ${voiceProfile})`
    );

    return NextResponse.json({
      success: true,
      npc: {
        id,
        worldId,
        agentId,
        placementJson,
        role: body.role,
        voiceProfile: body.voiceProfile,
      },
    });
  } catch (e) {
    console.error("[api/worlds/[worldId]/npcs POST]", e);
    return NextResponse.json({ error: "Failed to add NPC" }, { status: 500 });
  }
}
