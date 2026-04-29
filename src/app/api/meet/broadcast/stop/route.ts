import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { stopMeetBroadcastSession } from "@/lib/meet/broadcast-service";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json(
      { code: BROADCAST_CODES.notAuthenticated, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: { roomId?: string; hostWallet?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { code: "broadcast_bad_request", error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const roomId = (body.roomId ?? "").trim();
  if (!roomId) {
    return NextResponse.json(
      { code: "broadcast_bad_request", error: "roomId is required" },
      { status: 400 }
    );
  }

  const host = await assertMeetBroadcastHost(userId, body.hostWallet ?? null);
  if (!host.ok) {
    return NextResponse.json({ code: host.code, error: host.error }, { status: host.status });
  }

  try {
    const result = await stopMeetBroadcastSession({ userId, roomId });
    const code =
      result.code ??
      (result.stopped ? BROADCAST_CODES.ok : BROADCAST_CODES.stopNoop);

    return NextResponse.json({
      ok: true,
      code,
      stopped: result.stopped,
      egressId: result.egressId ?? null,
      message:
        code === BROADCAST_CODES.stopNoop
          ? "No active broadcast session for this room (already stopped or never started)."
          : undefined,
    });
  } catch (e) {
    console.error("[meet/broadcast/stop]", e);
    return NextResponse.json({ code: BROADCAST_CODES.egressFailed, error: "Stop failed" }, { status: 503 });
  }
}
