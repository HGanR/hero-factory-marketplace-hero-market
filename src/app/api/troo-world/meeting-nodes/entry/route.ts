/**
 * GET /api/troo-world/meeting-nodes/entry?roomId=...
 * Server-side validation for room entry. Returns redirect URL or error.
 * Validates: node exists, is active. Access rules (private/invite_only) deferred to Phase 3.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetingNodePlacements } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  try {
    const roomId = request.nextUrl.searchParams.get("roomId");
    if (!roomId || typeof roomId !== "string") {
      return NextResponse.json({ ok: false, error: "Invalid room" }, { status: 400 });
    }
    const parts = roomId.split(":");
    const nodeId = parts.length >= 2 ? parts.slice(1).join(":") : null;
    if (!nodeId) {
      return NextResponse.json({ ok: false, error: "Invalid room format" }, { status: 400 });
    }

    const db = await getDb();
    const [node] = await db
      .select({ id: meetingNodePlacements.id, title: meetingNodePlacements.title, isActive: meetingNodePlacements.isActive })
      .from(meetingNodePlacements)
      .where(eq(meetingNodePlacements.id, nodeId))
      .limit(1);

    if (!node) {
      return NextResponse.json({ ok: false, error: "Meeting room not found" }, { status: 404 });
    }
    if (!node.isActive) {
      return NextResponse.json({ ok: false, error: "This meeting room is currently disabled" }, { status: 403 });
    }

    const base = request.nextUrl.origin;
    const redirectUrl = `${base}/meet?room=${encodeURIComponent(roomId)}${node.title ? `&name=${encodeURIComponent(node.title)}` : ""}`;
    return NextResponse.json({ ok: true, redirectUrl, title: node.title });
  } catch (e) {
    console.error("[meeting-nodes entry]", e);
    return NextResponse.json({ ok: false, error: "Failed to validate room" }, { status: 500 });
  }
}
