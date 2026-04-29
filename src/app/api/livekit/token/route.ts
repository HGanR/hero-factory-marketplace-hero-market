import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

/**
 * POST /api/livekit/token
 * Generates a LiveKit access token for joining a room.
 *
 * Body: { roomName: string, participantIdentity?: string, participantName?: string, metadata?: string }
 * Returns: { token: string, serverUrl: string }
 *
 * Env: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
 */
export async function POST(req: NextRequest) {
  try {
    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!url || !apiKey || !apiSecret) {
      return NextResponse.json(
        {
          error:
            "LiveKit not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.",
        },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const roomName = (body?.roomName || body?.room || "").trim();
    const participantIdentity =
      (body?.participantIdentity || body?.identity || body?.address || "").trim() ||
      `participant-${Date.now()}`;
    const participantName =
      (body?.participantName || body?.name || "").trim() || "Participant";
    const metadata =
      typeof body?.metadata === "string" ? body.metadata : undefined;

    if (!roomName) {
      return NextResponse.json(
        { error: "roomName is required" },
        { status: 400 }
      );
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName,
      ttl: "6h",
      ...(metadata ? { metadata } : {}),
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      token,
      serverUrl: url,
    });
  } catch (err) {
    console.error("LiveKit token error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate token: ${message}` },
      { status: 500 }
    );
  }
}
