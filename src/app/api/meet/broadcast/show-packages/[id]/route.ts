import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import {
  deleteBroadcastShowPackage,
  getBroadcastShowPackageById,
  updateBroadcastShowPackage,
} from "@/lib/meet/broadcast-show-package-store";

type Ctx = { params: Promise<{ id: string }> };

function packDto(p: NonNullable<Awaited<ReturnType<typeof getBroadcastShowPackageById>>>) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    scenePresetId: p.scenePresetId,
    timelineTemplateId: p.timelineTemplateId,
    defaultBrandingJson: p.defaultBrandingJson,
    defaultOverlayPackId: p.defaultOverlayPackId,
    defaultGuestCardPackId: p.defaultGuestCardPackId,
    defaultRoomId: p.defaultRoomId,
    isDefault: p.isDefault,
    createdAtIso: p.createdAtIso,
    updatedAtIso: p.updatedAtIso,
  };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
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
      { ok: false, code: BROADCAST_CODES.broadcastShowPackageInvalid, error: "Invalid id" },
      { status: 400 }
    );
  }
  const url = new URL(_req.url);
  const host = await assertMeetBroadcastHost(userId, url.searchParams.get("hostWallet"));
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }
  const p = await getBroadcastShowPackageById(id, userId);
  if (!p) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastShowPackageNotFound, error: "Not found" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, package: packDto(p) });
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
      { ok: false, code: BROADCAST_CODES.broadcastShowPackageInvalid, error: "Invalid id" },
      { status: 400 }
    );
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastShowPackageInvalid, error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const host = await assertMeetBroadcastHost(userId, (body.hostWallet as string | null) ?? null);
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }
  const { hostWallet: _h, ...rest } = body;
  const r = await updateBroadcastShowPackage(id, userId, rest);
  if (!r.ok) {
    const nf = r.errors[0] === "not_found";
    return NextResponse.json(
      {
        ok: false,
        code: nf ? BROADCAST_CODES.broadcastShowPackageNotFound : BROADCAST_CODES.broadcastShowPackageInvalid,
        error: r.errors.join("; "),
      },
      { status: nf ? 404 : 400 }
    );
  }
  const p = await getBroadcastShowPackageById(id, userId);
  return NextResponse.json({ ok: true, package: p ? packDto(p) : null });
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
      { ok: false, code: BROADCAST_CODES.broadcastShowPackageInvalid, error: "Invalid id" },
      { status: 400 }
    );
  }
  const url = new URL(req.url);
  const host = await assertMeetBroadcastHost(userId, url.searchParams.get("hostWallet"));
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }
  const ok = await deleteBroadcastShowPackage(id, userId);
  if (!ok) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastShowPackageNotFound, error: "Not found" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
