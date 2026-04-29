import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { createBroadcastOverlayPack, listBroadcastOverlayPacksForUser } from "@/lib/meet/broadcast-overlay-pack-store";

export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.notAuthenticated, error: "Unauthorized" },
      { status: 401 }
    );
  }
  const host = await assertMeetBroadcastHost(userId, req.nextUrl.searchParams.get("hostWallet"));
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }
  const rows = await listBroadcastOverlayPacksForUser(userId);
  return NextResponse.json({
    ok: true,
    packs: rows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      lowerThirdPresetJson: p.lowerThirdPresetJson,
      tickerPresetJson: p.tickerPresetJson,
      ctaPresetJson: p.ctaPresetJson,
      createdAtIso: p.createdAtIso,
      updatedAtIso: p.updatedAtIso,
    })),
  });
}

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.notAuthenticated, error: "Unauthorized" },
      { status: 401 }
    );
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastOverlayPackInvalid, error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const host = await assertMeetBroadcastHost(userId, (body.hostWallet as string | null) ?? null);
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }
  const { hostWallet: _h, ...rest } = body;
  const r = await createBroadcastOverlayPack(userId, rest);
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastOverlayPackInvalid, error: r.errors.join("; ") },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, id: r.id });
}
