import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { getMeetBroadcastStatus } from "@/lib/meet/broadcast-service";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";

export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json(
      { code: BROADCAST_CODES.notAuthenticated, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const roomId = req.nextUrl.searchParams.get("roomId")?.trim() ?? "";
  if (!roomId) {
    return NextResponse.json(
      { code: "broadcast_bad_request", error: "roomId query required" },
      { status: 400 }
    );
  }

  const hostWallet = req.nextUrl.searchParams.get("hostWallet")?.trim() ?? "";
  const host = await assertMeetBroadcastHost(userId, hostWallet || null);
  if (!host.ok) {
    return NextResponse.json({ code: host.code, error: host.error }, { status: host.status });
  }

  try {
    const status = await getMeetBroadcastStatus({ userId, roomId });
    return NextResponse.json({
      code: BROADCAST_CODES.ok,
      ...status,
    });
  } catch (e) {
    console.error("[meet/broadcast/status]", e);
    return NextResponse.json({ code: BROADCAST_CODES.egressFailed, error: "Status failed" }, { status: 503 });
  }
}
