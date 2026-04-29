/**
 * GET /api/worlds/[worldId]/venue-nodes/[nodeId] — Get single venue node
 * PATCH /api/worlds/[worldId]/venue-nodes/[nodeId] — Update venue node (owner only)
 * DELETE /api/worlds/[worldId]/venue-nodes/[nodeId] — Delete venue node (owner only)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getAuthedUserId } from "@/lib/api/auth";
import { getWorldById } from "@/lib/api/worlds-helpers";
import { venueInteriorNodes } from "@/lib/db/schema.worlds";
import { updateVenueNodeSchema } from "@/lib/venue-nodes/validators";
import { getNodeTypePreset } from "@/lib/venue-nodes/node-type-presets";

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

function toNodeResponse(r: typeof venueInteriorNodes.$inferSelect) {
  const preset = getNodeTypePreset(r.nodeType);
  return {
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
    createdAt: r.createdAt?.toISOString(),
    updatedAt: r.updatedAt?.toISOString(),
    preset: {
      label: preset.label,
      description: preset.description,
      roomMode: preset.roomMode,
    },
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string; nodeId: string }> }
) {
  try {
    const { worldId, nodeId } = await params;
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

    const [node] = await db
      .select()
      .from(venueInteriorNodes)
      .where(and(eq(venueInteriorNodes.id, nodeId), eq(venueInteriorNodes.worldId, worldId)))
      .limit(1);

    if (!node) return NextResponse.json({ error: "Venue node not found" }, { status: 404 });

    return NextResponse.json(toNodeResponse(node));
  } catch (e) {
    console.error("[api/worlds/[worldId]/venue-nodes/[nodeId] GET]", e);
    return NextResponse.json({ error: "Failed to load venue node" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string; nodeId: string }> }
) {
  try {
    const { worldId, nodeId } = await params;
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

    const [existing] = await db
      .select()
      .from(venueInteriorNodes)
      .where(and(eq(venueInteriorNodes.id, nodeId), eq(venueInteriorNodes.worldId, worldId)))
      .limit(1);

    if (!existing) return NextResponse.json({ error: "Venue node not found" }, { status: 404 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = updateVenueNodeSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => e.message).join("; ");
      return NextResponse.json({ error: msg || "Validation failed" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.slug !== undefined) updates.slug = parsed.data.slug;
    if (parsed.data.nodeType !== undefined) updates.nodeType = parsed.data.nodeType;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.posX !== undefined) updates.posX = String(parsed.data.posX);
    if (parsed.data.posY !== undefined) updates.posY = String(parsed.data.posY);
    if (parsed.data.posZ !== undefined) updates.posZ = String(parsed.data.posZ);
    if (parsed.data.rotY !== undefined) updates.rotY = String(parsed.data.rotY);
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
    if (parsed.data.accessType !== undefined) updates.accessType = parsed.data.accessType;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(toNodeResponse(existing));
    }

    await db.update(venueInteriorNodes).set(updates as any).where(eq(venueInteriorNodes.id, nodeId));

    const [updated] = await db.select().from(venueInteriorNodes).where(eq(venueInteriorNodes.id, nodeId)).limit(1);
    return NextResponse.json(toNodeResponse(updated!));
  } catch (e) {
    console.error("[api/worlds/[worldId]/venue-nodes/[nodeId] PATCH]", e);
    return NextResponse.json({ error: "Failed to update venue node" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string; nodeId: string }> }
) {
  try {
    const { worldId, nodeId } = await params;
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

    const [existing] = await db
      .select()
      .from(venueInteriorNodes)
      .where(and(eq(venueInteriorNodes.id, nodeId), eq(venueInteriorNodes.worldId, worldId)))
      .limit(1);

    if (!existing) return NextResponse.json({ error: "Venue node not found" }, { status: 404 });

    await db.delete(venueInteriorNodes).where(eq(venueInteriorNodes.id, nodeId));

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error("[api/worlds/[worldId]/venue-nodes/[nodeId] DELETE]", e);
    return NextResponse.json({ error: "Failed to delete venue node" }, { status: 500 });
  }
}
