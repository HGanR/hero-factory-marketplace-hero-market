/**
 * PUT /api/worlds/[worldId]/commerce/[id] — Update commerce node (owner only)
 * DELETE /api/worlds/[worldId]/commerce/[id] — Delete commerce node (owner only)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { worlds, worldCommerceNodes } from "@/lib/db/schema.worlds";
import { getAuthedUserId } from "@/lib/api/auth";

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string; id: string }> }
) {
  try {
    const { worldId, id } = await params;
    const db = await getDb();

    const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
    if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });

    const auth = await isOwnerOrAdmin(request, world.ownerId);
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: auth.status }
      );
    }

    const [node] = await db
      .select()
      .from(worldCommerceNodes)
      .where(
        and(
          eq(worldCommerceNodes.id, id),
          eq(worldCommerceNodes.worldId, worldId),
          eq(worldCommerceNodes.ownerId, auth.userId)
        )
      )
      .limit(1);

    if (!node) return NextResponse.json({ error: "Commerce node not found" }, { status: 404 });

    let body: {
      placementJson?: unknown;
      title?: string;
      description?: string;
      agentId?: string;
      entityId?: string;
      priceToken?: number;
      priceUSD?: number;
      revenueShare?: number;
      status?: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.placementJson !== undefined) updates.placementJson = body.placementJson;
    if (body.title !== undefined) updates.title = String(body.title).slice(0, 120);
    if (body.description !== undefined) updates.description = body.description;
    if (body.agentId !== undefined) updates.agentId = body.agentId;
    if (body.entityId !== undefined) updates.entityId = body.entityId;
    if (body.priceToken !== undefined) updates.priceToken = body.priceToken;
    if (body.priceUSD !== undefined) updates.priceUSD = body.priceUSD;
    if (body.revenueShare !== undefined) updates.revenueShare = body.revenueShare;
    if (body.status !== undefined) {
      const valid = ["draft", "active", "paused", "archived"];
      if (valid.includes(body.status)) updates.status = body.status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, node });
    }

    await db
      .update(worldCommerceNodes)
      .set(updates as Record<string, string | number | null | object>)
      .where(eq(worldCommerceNodes.id, id));

    const [updated] = await db
      .select()
      .from(worldCommerceNodes)
      .where(eq(worldCommerceNodes.id, id))
      .limit(1);

    return NextResponse.json({
      success: true,
      node: updated
        ? {
            id: updated.id,
            worldId: updated.worldId,
            title: updated.title,
            status: updated.status,
          }
        : null,
    });
  } catch (e) {
    console.error("[api/worlds/[worldId]/commerce/[id] PUT]", e);
    return NextResponse.json({ error: "Failed to update commerce node" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string; id: string }> }
) {
  try {
    const { worldId, id } = await params;
    const db = await getDb();

    const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
    if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });

    const auth = await isOwnerOrAdmin(request, world.ownerId);
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: auth.status }
      );
    }

    const [node] = await db
      .select()
      .from(worldCommerceNodes)
      .where(
        and(
          eq(worldCommerceNodes.id, id),
          eq(worldCommerceNodes.worldId, worldId),
          eq(worldCommerceNodes.ownerId, auth.userId)
        )
      )
      .limit(1);

    if (!node) return NextResponse.json({ error: "Commerce node not found" }, { status: 404 });

    await db.delete(worldCommerceNodes).where(eq(worldCommerceNodes.id, id));

    return NextResponse.json({ success: true, deleted: id });
  } catch (e) {
    console.error("[api/worlds/[worldId]/commerce/[id] DELETE]", e);
    return NextResponse.json({ error: "Failed to delete commerce node" }, { status: 500 });
  }
}
