/**
 * GET /api/worlds/venue-nodes/entry?roomId=...
 * Server-side validation for venue room entry. Returns redirect URL or error.
 * roomId format: {worldId}:{placementId}:{nodeId}
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { venueInteriorNodes } from "@/lib/db/schema.worlds";
import { parseVenueRoomId } from "@/lib/venue-nodes/room-id";
import { getNodeTypePreset, getRoomBehaviorSummary } from "@/lib/venue-nodes/node-type-presets";

export async function GET(request: NextRequest) {
  try {
    const roomId = request.nextUrl.searchParams.get("roomId");
    if (!roomId || typeof roomId !== "string") {
      return NextResponse.json({ ok: false, error: "Invalid room" }, { status: 400 });
    }

    const parsed = parseVenueRoomId(roomId);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const db = await getDb();
    const [node] = await db
      .select({
        id: venueInteriorNodes.id,
        title: venueInteriorNodes.title,
        nodeType: venueInteriorNodes.nodeType,
        accessType: venueInteriorNodes.accessType,
        isActive: venueInteriorNodes.isActive,
      })
      .from(venueInteriorNodes)
      .where(eq(venueInteriorNodes.id, parsed.nodeId))
      .limit(1);

    if (!node) {
      return NextResponse.json({ ok: false, error: "Meeting room not found" }, { status: 404 });
    }
    if (!node.isActive) {
      return NextResponse.json({ ok: false, error: "This meeting room is currently disabled" }, { status: 403 });
    }

    const preset = getNodeTypePreset(node.nodeType);
    const presetSummary = getRoomBehaviorSummary(node.nodeType);

    const base = request.nextUrl.origin;
    const params = new URLSearchParams();
    params.set("room", roomId);
    if (node.title) params.set("name", node.title);
    params.set("presetLabel", presetSummary);
    const redirectUrl = `${base}/meet?${params.toString()}`;

    return NextResponse.json({
      ok: true,
      redirectUrl,
      title: node.title,
      nodeType: node.nodeType,
      accessType: node.accessType,
      preset: {
        label: preset.label,
        roomMode: preset.roomMode,
        description: preset.description,
      },
      presetSummary,
    });
  } catch (e) {
    console.error("[venue-nodes entry]", e);
    return NextResponse.json({ ok: false, error: "Failed to validate room" }, { status: 500 });
  }
}
