/**
 * POST /api/troo-world/meeting-nodes/analytics
 * Track meeting node events (fire-and-forget, no auth required for MVP).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { meetingNodeEvents } from "@/lib/db/schema";

const ALLOWED_EVENTS = new Set([
  "node_created",
  "node_edited",
  "node_deleted",
  "node_clicked",
  "enter_meeting_clicked",
  "room_entry_success",
  "room_entry_failure",
  "copy_invite_clicked",
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { event, nodeId, roomId, worldId, payload } = body as {
      event?: string;
      nodeId?: string;
      roomId?: string;
      worldId?: string;
      payload?: Record<string, unknown>;
    };
    if (!event || !ALLOWED_EVENTS.has(event)) {
      return NextResponse.json({ ok: false, error: "Invalid event" }, { status: 400 });
    }
    const db = await getDb();
    await db.insert(meetingNodeEvents).values({
      event,
      nodeId: nodeId ?? null,
      roomId: roomId ?? null,
      worldId: worldId ?? null,
      payload: payload ? JSON.stringify(payload) : null,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[meeting-nodes analytics]", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
