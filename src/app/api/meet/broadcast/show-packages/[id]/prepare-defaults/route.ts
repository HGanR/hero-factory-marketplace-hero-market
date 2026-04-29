import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { getShowPackagePrepareDefaults, recordBroadcastShowPackageApplied } from "@/lib/meet/broadcast-show-package-store";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/meet/broadcast/show-packages/[id]/prepare-defaults
 * Returns bundled launch defaults for this package (no event mutation). Records apply metric/audit.
 */
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
      { ok: false, code: BROADCAST_CODES.broadcastShowPackageInvalid, error: "Invalid id" },
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

  const r = await getShowPackagePrepareDefaults(userId, id);
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

  recordBroadcastShowPackageApplied(userId, id);

  return NextResponse.json({
    ok: true,
    showPackageSummary: r.showPackageSummary,
    launchDefaults: r.launchDefaults,
    overlayPackSummary: r.overlayPackSummary,
    guestCardPackSummary: r.guestCardPackSummary,
  });
}
