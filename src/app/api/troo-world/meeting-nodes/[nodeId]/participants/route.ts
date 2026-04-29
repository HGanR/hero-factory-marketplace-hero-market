/**
 * GET /api/troo-world/meeting-nodes/[nodeId]/participants
 * Returns participant list from LiveKit when configured; otherwise empty.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { RoomServiceClient } from "livekit-server-sdk";
import { getDb } from "@/lib/db";
import { meetingNodePlacements } from "@/lib/db/schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const { nodeId } = await params;
    const db = await getDb();

    const [node] = await db
      .select({ id: meetingNodePlacements.id, roomId: meetingNodePlacements.roomId, title: meetingNodePlacements.title })
      .from(meetingNodePlacements)
      .where(eq(meetingNodePlacements.id, nodeId))
      .limit(1);

    if (!node) {
      return NextResponse.json({ error: "Meeting node not found" }, { status: 404 });
    }

    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!url || !apiKey || !apiSecret || !node.roomId) {
      return NextResponse.json({
        roomId: node.roomId,
        roomName: node.title,
        participants: [],
        count: 0,
      });
    }

    const host = url.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
    const roomClient = new RoomServiceClient(host, apiKey, apiSecret);

    let participants: Awaited<ReturnType<RoomServiceClient["listParticipants"]>> = [];
    try {
      participants = await roomClient.listParticipants(node.roomId);
    } catch (err) {
      // Room may not exist yet (no one has joined); treat as empty
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes("room") && !msg.toLowerCase().includes("not found") && !msg.toLowerCase().includes("404")) {
        throw err;
      }
    }

    return NextResponse.json({
      roomId: node.roomId,
      roomName: node.title,
      participants: participants.map((p) => ({
        identity: p.identity,
        name: p.name,
        metadata: p.metadata,
      })),
      count: participants.length,
    });
  } catch (e) {
    console.error("[meeting-nodes participants GET]", e);
    return NextResponse.json({ error: "Failed to load participants" }, { status: 500 });
  }
}
