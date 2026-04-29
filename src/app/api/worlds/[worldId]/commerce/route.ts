/**
 * GET /api/worlds/[worldId]/commerce — List commerce nodes for a world
 * POST /api/worlds/[worldId]/commerce — Create commerce node (owner only)
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getAuthedUserId } from "@/lib/api/auth";
import { getWorldById } from "@/lib/api/worlds-helpers";
import { emitPlatformEvent } from "@/lib/workflow-engine/emit-platform-event";
import crypto from "crypto";

function generateId(): string {
  return crypto.randomUUID();
}

async function isOwnerOrAdmin(
  request: NextRequest,
  ownerId: number
): Promise<{ ok: true; userId: number } | { ok: false; status: number }> {
  const userId = await getAuthedUserId();
  if (userId !== null && userId === ownerId) return { ok: true, userId };
  const adminToken = request.cookies.get("admin-token")?.value;
  if (adminToken) {
    const { verifyToken } = await import("@/lib/auth");
    const decoded = verifyToken(adminToken);
    if (decoded?.isAdmin && decoded?.userId) {
      return { ok: true, userId: decoded.userId as number };
    }
  }
  return { ok: false, status: userId ? 403 : 401 };
}

export async function GET(
  request: NextRequest,
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

    let nodes: Array<{ id: string; worldId: string; ownerId: number; nodeType: string; placementJson: unknown; assetId: string | null; title: string; description: string | null; agentId: string | null; entityId: string | null; priceToken: number | null; priceUSD: number | null; revenueShare: number | null; status: string; createdAt: Date }> = [];
    try {
      const [rows] = (await db.execute(
        isOwner
          ? sql`SELECT id, worldId, ownerId, nodeType, placementJson, assetId, title, description, agentId, entityId, priceToken, priceUSD, revenueShare, status, createdAt FROM world_commerce_nodes WHERE worldId = ${worldId}`
          : sql`SELECT id, worldId, ownerId, nodeType, placementJson, assetId, title, description, agentId, entityId, priceToken, priceUSD, revenueShare, status, createdAt FROM world_commerce_nodes WHERE worldId = ${worldId} AND status = 'active'`
      )) as any;
      const arr = Array.isArray(rows) ? rows : rows?.rows ?? rows ?? [];
      nodes = Array.isArray(arr) ? arr : [arr];
    } catch {
      // world_commerce_nodes may not exist
    }

    return NextResponse.json({
      nodes: nodes.map((n) => ({
        id: n.id,
        worldId: n.worldId,
        ownerId: n.ownerId,
        nodeType: n.nodeType,
        placementJson: n.placementJson,
        assetId: n.assetId,
        title: n.title,
        description: n.description,
        agentId: n.agentId,
        entityId: n.entityId,
        priceToken: n.priceToken,
        priceUSD: n.priceUSD,
        revenueShare: n.revenueShare,
        status: n.status,
        createdAt: n.createdAt?.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[api/worlds/[worldId]/commerce GET]", e);
    return NextResponse.json({ error: "Failed to load commerce nodes" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  try {
    const { worldId } = await params;
    const db = await getDb();

    const world = await getWorldById(db, worldId);
    if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });

    const auth = await isOwnerOrAdmin(request, world.ownerId);
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: auth.status }
      );
    }

    let body: {
      nodeType?: string;
      placementJson?: unknown;
      assetId?: string;
      title?: string;
      description?: string;
      agentId?: string;
      entityId?: string;
      priceToken?: number;
      priceUSD?: number;
      revenueShare?: number;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const nodeType = body.nodeType ?? "store";
    const validTypes = [
      "store",
      "service",
      "consultation",
      "ad_space",
      "product_display",
      "event_space",
      "course",
      "npc_service",
    ];
    if (!validTypes.includes(nodeType)) {
      return NextResponse.json({ error: "Invalid nodeType" }, { status: 400 });
    }

    const placementJson = body.placementJson ?? { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
    const title = String(body.title ?? "Commerce Node").slice(0, 120);

    const id = generateId();
    await db.execute(
      sql`INSERT INTO world_commerce_nodes (id, worldId, ownerId, nodeType, placementJson, assetId, title, description, agentId, entityId, priceToken, priceUSD, revenueShare, status)
          VALUES (${id}, ${worldId}, ${auth.userId}, ${nodeType}, ${placementJson}, ${body.assetId ?? null}, ${title}, ${body.description ?? null}, ${body.agentId ?? null}, ${body.entityId ?? null}, ${body.priceToken ?? null}, ${body.priceUSD ?? null}, ${body.revenueShare ?? null}, ${"active"})`
    );

    try {
      await emitPlatformEvent(
        "commerce_node_created",
        { worldId, nodeId: id, nodeType, title, ownerId: auth.userId },
        auth.userId
      );
    } catch {
      // Don't fail create if event fails
    }

    return NextResponse.json({
      success: true,
      node: {
        id,
        worldId,
        ownerId: auth.userId,
        nodeType,
        placementJson,
        title,
        status: "active",
      },
    });
  } catch (e) {
    console.error("[api/worlds/[worldId]/commerce POST]", e);
    return NextResponse.json({ error: "Failed to create commerce node" }, { status: 500 });
  }
}
