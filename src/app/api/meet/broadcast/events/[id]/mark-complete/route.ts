import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { updateBroadcastEventStatus } from "@/lib/meet/broadcast-event-store";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.notAuthenticated, error: "Unauthorized" },
      { status: 401 }
    );
  }
  const { id: idRaw } = await ctx.params;
  const id = Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastEventInvalid, error: "Invalid id" },
      { status: 400 }
    );
  }
  let hostWallet: string | null = null;
  try {
    const b = (await req.json()) as { hostWallet?: string | null };
    hostWallet = b.hostWallet ?? null;
  } catch {
    hostWallet = null;
  }
  const host = await assertMeetBroadcastHost(userId, hostWallet);
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }
  const ok = await updateBroadcastEventStatus(id, userId, "completed");
  if (!ok) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastEventNotFound, error: "Not found" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
