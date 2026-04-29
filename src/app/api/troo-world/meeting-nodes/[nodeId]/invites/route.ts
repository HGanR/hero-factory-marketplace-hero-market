/**
 * POST /api/troo-world/meeting-nodes/[nodeId]/invites — Create invite (auth required)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetingNodePlacements, meetingInvites } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import crypto from "crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const userId = await getAuthedUserId();
    if (userId === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { nodeId } = await params;
    const db = await getDb();
    const body = await request.json().catch(() => ({}));
    const { inviteeEmail, inviteeUserId, expiresInHours = 168 } = body as {
      inviteeEmail?: string;
      inviteeUserId?: number;
      expiresInHours?: number;
    };

    const [node] = await db
      .select({ id: meetingNodePlacements.id, worldId: meetingNodePlacements.worldId, roomId: meetingNodePlacements.roomId, title: meetingNodePlacements.title })
      .from(meetingNodePlacements)
      .where(eq(meetingNodePlacements.id, nodeId))
      .limit(1);

    if (!node) {
      return NextResponse.json({ error: "Meeting node not found" }, { status: 404 });
    }

    const inviteToken = crypto.randomBytes(32).toString("hex");
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + Math.min(720, Math.max(1, Number(expiresInHours) || 168)) * 60 * 60 * 1000);

    await db.insert(meetingInvites).values({
      id,
      meetingNodeId: nodeId,
      invitedByUserId: userId,
      inviteeUserId: inviteeUserId ?? null,
      inviteeEmail: inviteeEmail?.trim().slice(0, 320) ?? null,
      inviteeWallet: null,
      inviteToken,
      status: "pending",
      expiresAt,
    });

    const base = request.nextUrl.origin;
    const inviteUrl = `${base}/meet/invite/${inviteToken}`;

    return NextResponse.json({
      success: true,
      id,
      inviteToken,
      inviteUrl,
      roomId: node.roomId,
      roomName: node.title,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (e) {
    console.error("[meeting-nodes invites POST]", e);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }
}
