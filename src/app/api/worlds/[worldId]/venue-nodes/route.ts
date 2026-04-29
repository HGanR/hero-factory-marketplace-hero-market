/**
 * GET /api/worlds/[worldId]/venue-nodes — List venue interior nodes
 * POST /api/worlds/[worldId]/venue-nodes — Create venue interior node (owner only)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getAuthedUserId } from "@/lib/api/auth";
import { getWorldById } from "@/lib/api/worlds-helpers";
import { venueInteriorNodes } from "@/lib/db/schema.worlds";
import { createVenueNodeSchema } from "@/lib/venue-nodes/validators";
import { buildVenueRoomId } from "@/lib/venue-nodes/room-id";
import { getNodeTypePreset } from "@/lib/venue-nodes/node-type-presets";
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

/**
 * Validate placement for venue interior node creation.
 * Policy: Only placements whose asset category is "venue" may have new nodes created.
 * Existing nodes on non-venue placements remain readable for backward compatibility.
 */
async function validatePlacementForCreate(
  db: Awaited<ReturnType<typeof getDb>>,
  worldId: string,
  placementId: string
): Promise<{ ok: true; assetId: string } | { ok: false; error: string }> {
  try {
    const [versionRows] = (await db.execute(
      sql`SELECT id FROM world_versions WHERE worldId = ${worldId} AND versionType = 'draft' LIMIT 1`
    )) as any;
    const version = Array.isArray(versionRows) ? versionRows[0] : versionRows?.rows?.[0] ?? versionRows;
    if (!version?.id) return { ok: false, error: "World draft not found" };

    const [chunkRows] = (await db.execute(
      sql`SELECT placementsJson FROM world_chunk_placements WHERE worldVersionId = ${version.id}`
    )) as any;
    const chunks = Array.isArray(chunkRows) ? chunkRows : chunkRows?.rows ?? chunkRows ?? [];
    const placements = (Array.isArray(chunks) ? chunks : [chunks]).flatMap((c: { placementsJson?: unknown }) => {
      const json = c.placementsJson;
      return Array.isArray(json) ? json : [];
    });

    const placement = placements.find((p: { id?: string }) => p?.id === placementId);
    if (!placement) return { ok: false, error: "Placement not found in world" };

    const assetId = (placement as { assetId?: string; elementId?: string }).assetId ?? (placement as { assetId?: string; elementId?: string }).elementId;
    if (!assetId || typeof assetId !== "string") return { ok: false, error: "Placement has no assetId" };

    const [assetRows] = (await db.execute(
      sql`SELECT category FROM world_library_assets WHERE id = ${assetId} AND status = 'published' LIMIT 1`
    )) as any;
    const asset = Array.isArray(assetRows) ? assetRows[0] : assetRows?.rows?.[0] ?? assetRows;
    const category = asset?.category ?? "";
    if (category !== "venue") {
      return { ok: false, error: "Venue interior nodes may only be created for placements whose asset category is 'venue'" };
    }

    return { ok: true, assetId: String(assetId) };
  } catch (e) {
    console.error("[venue-nodes validatePlacementForCreate]", e);
    return { ok: false, error: "Failed to validate placement" };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  try {
    const { worldId } = await params;
    const placementId = request.nextUrl.searchParams.get("placementId");
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

    let nodes: Array<{
      id: string;
      worldId: string;
      placementId: string;
      title: string;
      slug: string | null;
      nodeType: string;
      description: string | null;
      posX: number;
      posY: number;
      posZ: number;
      rotY: number;
      isActive: boolean;
      accessType: string;
      roomId: string;
      createdAt: Date;
      updatedAt: Date;
    }> = [];

    try {
      const rows = await db
        .select()
        .from(venueInteriorNodes)
        .where(
          placementId
            ? and(eq(venueInteriorNodes.worldId, worldId), eq(venueInteriorNodes.placementId, placementId))
            : eq(venueInteriorNodes.worldId, worldId)
        );
      nodes = rows.map((r) => ({
        id: r.id,
        worldId: r.worldId,
        placementId: r.placementId,
        title: r.title,
        slug: r.slug,
        nodeType: r.nodeType,
        description: r.description,
        posX: Number(r.posX),
        posY: Number(r.posY),
        posZ: Number(r.posZ),
        rotY: Number(r.rotY),
        isActive: r.isActive,
        accessType: r.accessType,
        roomId: r.roomId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    } catch {
      // Table may not exist yet
    }

    return NextResponse.json({
      nodes: nodes.map((n) => {
        const preset = getNodeTypePreset(n.nodeType);
        return {
          ...n,
          createdAt: n.createdAt?.toISOString(),
          updatedAt: n.updatedAt?.toISOString(),
          preset: {
            label: preset.label,
            description: preset.description,
            roomMode: preset.roomMode,
          },
        };
      }),
    });
  } catch (e) {
    console.error("[api/worlds/[worldId]/venue-nodes GET]", e);
    return NextResponse.json({ error: "Failed to load venue nodes" }, { status: 500 });
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createVenueNodeSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => e.message).join("; ");
      return NextResponse.json({ error: msg || "Validation failed" }, { status: 400 });
    }

    const input = parsed.data;

    const placementCheck = await validatePlacementForCreate(db, worldId, input.placementId);
    if (!placementCheck.ok) {
      return NextResponse.json({ error: placementCheck.error }, { status: 400 });
    }

    const nodeId = generateId();
    const roomId = buildVenueRoomId(worldId, input.placementId, nodeId);

    await db.insert(venueInteriorNodes).values({
      id: nodeId,
      worldId,
      placementId: input.placementId,
      title: input.title,
      slug: input.slug ?? null,
      nodeType: input.nodeType,
      description: input.description ?? null,
      posX: String(input.posX),
      posY: String(input.posY),
      posZ: String(input.posZ),
      rotY: String(input.rotY),
      isActive: true,
      accessType: input.accessType,
      roomId,
      createdByUserId: auth.userId,
    });

    const [created] = await db.select().from(venueInteriorNodes).where(eq(venueInteriorNodes.id, nodeId)).limit(1);

    const preset = getNodeTypePreset(created.nodeType);
    return NextResponse.json(
      {
        id: created.id,
        worldId: created.worldId,
        placementId: created.placementId,
        title: created.title,
        slug: created.slug,
        nodeType: created.nodeType,
        description: created.description,
        posX: Number(created.posX),
        posY: Number(created.posY),
        posZ: Number(created.posZ),
        rotY: Number(created.rotY),
        isActive: created.isActive,
        accessType: created.accessType,
        roomId: created.roomId,
        createdAt: created.createdAt?.toISOString(),
        updatedAt: created.updatedAt?.toISOString(),
        preset: {
          label: preset.label,
          description: preset.description,
          roomMode: preset.roomMode,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[api/worlds/[worldId]/venue-nodes POST]", e);
    return NextResponse.json({ error: "Failed to create venue node" }, { status: 500 });
  }
}
