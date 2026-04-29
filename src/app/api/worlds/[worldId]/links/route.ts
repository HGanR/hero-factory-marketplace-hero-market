/**
 * GET /api/worlds/[worldId]/links — List world links (outgoing from this world)
 * POST /api/worlds/[worldId]/links — Add world link (owner only)
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getAuthedUserId } from "@/lib/api/auth";
import { getWorldById } from "@/lib/api/worlds-helpers";
import crypto from "crypto";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  try {
    const { worldId } = await params;
    const db = await getDb();
    const userId = await getAuthedUserId();

    const world = await getWorldById(db, worldId);
    if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });

    const isOwner = userId !== null && Number(world.ownerId) === userId;
    const isPublic = world.visibility === "public" || world.visibility === "unlisted";
    const isPublished = world.status === "published";
    if (!isOwner && (!isPublic || !isPublished)) {
      return NextResponse.json({ error: "World not found" }, { status: 404 });
    }

    let links: Array<{ id: string; fromWorldId: string; toWorldId: string; label: string | null; placementJson: unknown }> = [];
    try {
      const [rows] = (await db.execute(
        sql`SELECT id, fromWorldId, toWorldId, label, placementJson FROM world_links WHERE fromWorldId = ${worldId}`
      )) as any;
      const arr = Array.isArray(rows) ? rows : rows?.rows ?? rows ?? [];
      links = Array.isArray(arr) ? arr : [arr];
    } catch {
      // world_links may not exist
    }

    return NextResponse.json({
      links: links.map((l) => ({
        id: l.id,
        fromWorldId: l.fromWorldId,
        toWorldId: l.toWorldId,
        label: l.label,
        placementJson: l.placementJson,
      })),
    });
  } catch (e) {
    console.error("[api/worlds/[worldId]/links GET]", e);
    return NextResponse.json({ error: "Failed to load links" }, { status: 500 });
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

    let body: { toWorldId?: string; label?: string; placementJson?: unknown };
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const toWorldId = String(body.toWorldId ?? "").trim();
    if (!toWorldId) return NextResponse.json({ error: "toWorldId required" }, { status: 400 });

    const db = await getDb();
    const world = await getWorldById(db, worldId);
    if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });
    if (Number(world.ownerId) !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const targetWorld = await getWorldById(db, toWorldId);
    if (!targetWorld) return NextResponse.json({ error: "Target world not found" }, { status: 404 });

    const id = crypto.randomUUID();
    const label = body.label?.slice(0, 120) ?? null;
    const placementJson = body.placementJson != null ? body.placementJson : null;
    await db.execute(
      sql`INSERT INTO world_links (id, fromWorldId, toWorldId, label, placementJson) VALUES (${id}, ${worldId}, ${toWorldId}, ${label}, ${placementJson})`
    );

    return NextResponse.json({
      success: true,
      link: {
        id,
        fromWorldId: worldId,
        toWorldId,
        label: body.label,
        placementJson: body.placementJson,
      },
    });
  } catch (e) {
    console.error("[api/worlds/[worldId]/links POST]", e);
    return NextResponse.json({ error: "Failed to add link" }, { status: 500 });
  }
}
