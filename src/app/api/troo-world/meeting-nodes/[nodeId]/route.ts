/**
 * GET /api/troo-world/meeting-nodes/[nodeId] — Get single node
 * PATCH /api/troo-world/meeting-nodes/[nodeId] — Update node (admin or auth)
 * DELETE /api/troo-world/meeting-nodes/[nodeId] — Delete node (admin or auth)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetingNodePlacements, trooWorldPlacements } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

function requireAdminOrAuth(request: NextRequest): number | null {
  const token =
    request.cookies?.get?.("admin-token")?.value || request.cookies?.get?.("auth-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;
  if (decoded.userId != null && typeof decoded.userId === "number") return decoded.userId;
  if (decoded.isAdmin) return 0;
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const { nodeId } = await params;
    const db = await getDb();

    const [node] = await db
      .select()
      .from(meetingNodePlacements)
      .where(eq(meetingNodePlacements.id, nodeId))
      .limit(1);

    if (!node) {
      return NextResponse.json({ error: "Meeting node not found" }, { status: 404 });
    }

    const [parent] = await db
      .select({ elementKey: trooWorldPlacements.elementKey, posX: trooWorldPlacements.posX, posY: trooWorldPlacements.posY, posZ: trooWorldPlacements.posZ })
      .from(trooWorldPlacements)
      .where(eq(trooWorldPlacements.id, node.parentPlacementId))
      .limit(1);

    return NextResponse.json({
      id: node.id,
      worldId: node.worldId,
      parentPlacementId: node.parentPlacementId,
      parentElementKey: parent?.elementKey ?? null,
      nodeAssetKey: node.nodeAssetKey,
      roomId: node.roomId,
      title: node.title,
      accessType: node.accessType,
      capacity: node.capacity,
      webEnabled: node.webEnabled,
      webxrEnabled: node.webxrEnabled,
      vrEnabled: node.vrEnabled,
      isActive: node.isActive,
      posX: Number(node.posX),
      posY: Number(node.posY),
      posZ: Number(node.posZ),
      rotY: Number(node.rotY),
      scale: Number(node.scale),
      worldPosX: parent ? Number(parent.posX) + Number(node.posX) : Number(node.posX),
      worldPosY: parent ? Number(parent.posY) + Number(node.posY) : Number(node.posY),
      worldPosZ: parent ? Number(parent.posZ) + Number(node.posZ) : Number(node.posZ),
    });
  } catch (e) {
    console.error("[troo-world meeting-nodes GET nodeId]", e);
    return NextResponse.json({ error: "Failed to load meeting node" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const userId = requireAdminOrAuth(request);
    if (userId === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { nodeId } = await params;
    const db = await getDb();
    const body = await request.json();

    const [existing] = await db
      .select()
      .from(meetingNodePlacements)
      .where(eq(meetingNodePlacements.id, nodeId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Meeting node not found" }, { status: 404 });
    }

    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = String(body.title).trim().slice(0, 120);
    if (body.accessType !== undefined && ["public", "private", "invite_only"].includes(body.accessType)) patch.accessType = body.accessType;
    if (body.capacity !== undefined) patch.capacity = Math.max(2, Math.min(100, Number(body.capacity) || 12));
    if (body.webEnabled !== undefined) patch.webEnabled = !!body.webEnabled;
    if (body.webxrEnabled !== undefined) patch.webxrEnabled = !!body.webxrEnabled;
    if (body.vrEnabled !== undefined) patch.vrEnabled = !!body.vrEnabled;
    if (body.isActive !== undefined) patch.isActive = !!body.isActive;
    if (body.posX !== undefined) patch.posX = String(Number(body.posX) || 0);
    if (body.posY !== undefined) patch.posY = String(Number(body.posY) || 0);
    if (body.posZ !== undefined) patch.posZ = String(Number(body.posZ) || 0);
    if (body.rotY !== undefined) patch.rotY = String(Number(body.rotY) || 0);
    if (body.scale !== undefined) patch.scale = String(Number(body.scale) || 1);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: true, message: "No changes" });
    }

    await db
      .update(meetingNodePlacements)
      .set({ ...patch, updatedAt: new Date() } as Record<string, unknown>)
      .where(eq(meetingNodePlacements.id, nodeId));

    return NextResponse.json({ success: true, message: "Meeting node updated" });
  } catch (e) {
    console.error("[troo-world meeting-nodes PATCH]", e);
    return NextResponse.json({ error: "Failed to update meeting node" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const userId = requireAdminOrAuth(request);
    if (userId === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { nodeId } = await params;
    const db = await getDb();

    const [existing] = await db
      .select({ id: meetingNodePlacements.id })
      .from(meetingNodePlacements)
      .where(eq(meetingNodePlacements.id, nodeId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Meeting node not found" }, { status: 404 });
    }

    await db.delete(meetingNodePlacements).where(eq(meetingNodePlacements.id, nodeId));

    return NextResponse.json({ success: true, message: "Meeting node deleted" });
  } catch (e) {
    console.error("[troo-world meeting-nodes DELETE]", e);
    return NextResponse.json({ error: "Failed to delete meeting node" }, { status: 500 });
  }
}
