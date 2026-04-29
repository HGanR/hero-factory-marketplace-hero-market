import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import {
  deleteBroadcastOverlayPack,
  getBroadcastOverlayPackById,
  updateBroadcastOverlayPack,
} from "@/lib/meet/broadcast-overlay-pack-store";

type Ctx = { params: Promise<{ id: string }> };

function packDto(p: NonNullable<Awaited<ReturnType<typeof getBroadcastOverlayPackById>>>) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    lowerThirdPresetJson: p.lowerThirdPresetJson,
    tickerPresetJson: p.tickerPresetJson,
    ctaPresetJson: p.ctaPresetJson,
    createdAtIso: p.createdAtIso,
    updatedAtIso: p.updatedAtIso,
  };
}

export async function GET(req: NextRequest, ctx: Ctx) {
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
      { ok: false, code: BROADCAST_CODES.broadcastOverlayPackInvalid, error: "Invalid id" },
      { status: 400 }
    );
  }
  const url = new URL(req.url);
  const host = await assertMeetBroadcastHost(userId, url.searchParams.get("hostWallet"));
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }
  const p = await getBroadcastOverlayPackById(id, userId);
  if (!p) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastOverlayPackNotFound, error: "Not found" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, pack: packDto(p) });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
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
      { ok: false, code: BROADCAST_CODES.broadcastOverlayPackInvalid, error: "Invalid id" },
      { status: 400 }
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
  const r = await updateBroadcastOverlayPack(id, userId, rest);
  if (!r.ok) {
    const nf = r.errors[0] === "not_found";
    return NextResponse.json(
      {
        ok: false,
        code: nf ? BROADCAST_CODES.broadcastOverlayPackNotFound : BROADCAST_CODES.broadcastOverlayPackInvalid,
        error: r.errors.join("; "),
      },
      { status: nf ? 404 : 400 }
    );
  }
  const p = await getBroadcastOverlayPackById(id, userId);
  return NextResponse.json({ ok: true, pack: p ? packDto(p) : null });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
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
      { ok: false, code: BROADCAST_CODES.broadcastOverlayPackInvalid, error: "Invalid id" },
      { status: 400 }
    );
  }
  const url = new URL(req.url);
  const host = await assertMeetBroadcastHost(userId, url.searchParams.get("hostWallet"));
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }
  const ok = await deleteBroadcastOverlayPack(id, userId);
  if (!ok) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastOverlayPackNotFound, error: "Not found" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
