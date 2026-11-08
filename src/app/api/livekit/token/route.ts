import { NextRequest, NextResponse } from "next/server";
import { stadiumAccess, stadiumNode, physical } from '@/lib/stadium/server';
import { RoomServiceClient, AccessToken } from "livekit-server-sdk";

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
    let roomName = (body?.roomName || body?.room || "").trim();
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

    if (/^stadium-event-/i.test(roomName)) return NextResponse.json({error:'Use the stadium entrance'},{status:403});
    let stadiumRole: 'host'|'audience'|null=null;
    let identity=participantIdentity;
    const id=roomName.includes(':')?roomName.split(':').pop():null;
    const node=id ? await stadiumNode(id.toLowerCase()) : undefined;
    if(node){
      if(node.roomId?.toLowerCase()!==roomName.toLowerCase()) return NextResponse.json({error:'Invalid room'},{status:403});
      const access=await stadiumAccess(req,node);
      if(access.status!==200) return NextResponse.json({error:'A valid stadium invitation and sign-in are required'},{status:access.status});
      stadiumRole=access.host?'host':'audience';
      identity=access.user===null?'guest-'+crypto.randomUUID():'account-'+access.user;
      roomName=physical(node.id);
      const service=new RoomServiceClient(url.replace(/^ws/,'http'),apiKey,apiSecret);
      let [room]=await service.listRooms([roomName]);
      if(!room && access.host) room=await service.createRoom({name:roomName,maxParticipants:node.capacity,emptyTimeout:120,departureTimeout:120});
      if(!room) return NextResponse.json({error:'The host has not opened this event yet.'},{status:409});
      if(room.maxParticipants!==node.capacity) return NextResponse.json({error:'Room capacity has changed. Reopen the event.'},{status:409});
      // The media server enforces maxParticipants atomically at connection time.
    }
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: participantName,
      ttl: stadiumRole ? "45s" : "6h",
      ...(stadiumRole ? {metadata:JSON.stringify({role:stadiumRole})} : metadata ? { metadata } : {}),
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: stadiumRole !== "audience",
      canPublishData: stadiumRole !== "audience",
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      token, stadiumRole,
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
