/**
 * GET /api/invites/[token] — Resolve invite, return roomId for redirect
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetingInvites, meetingNodePlacements } from "@/lib/db/schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.length < 16) {
      return NextResponse.json({ error: "Invalid invite" }, { status: 400 });
    }

    const db = await getDb();
    const [invite] = await db
      .select({
        id: meetingInvites.id,
        meetingNodeId: meetingInvites.meetingNodeId,
        status: meetingInvites.status,
        expiresAt: meetingInvites.expiresAt,
      })
      .from(meetingInvites)
      .where(eq(meetingInvites.inviteToken, token))
      .limit(1);

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }
    if (invite.status !== "pending") {
      return NextResponse.json({ error: "Invite no longer valid" }, { status: 410 });
    }
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Invite expired" }, { status: 410 });
    }

    const [node] = await db
      .select({ roomId: meetingNodePlacements.roomId, title: meetingNodePlacements.title, isActive: meetingNodePlacements.isActive })
      .from(meetingNodePlacements)
      .where(eq(meetingNodePlacements.id, invite.meetingNodeId))
      .limit(1);

    if (!node || !node.isActive) {
      return NextResponse.json({ error: "Meeting room unavailable" }, { status: 410 });
    }

    return NextResponse.json({
      ok: true,
      roomId: node.roomId,
      roomName: node.title,
      nodeId: invite.meetingNodeId,
    });
  } catch (e) {
    console.error("[invites resolve]", e);
    return NextResponse.json({ error: "Failed to resolve invite" }, { status: 500 });
  }
}
