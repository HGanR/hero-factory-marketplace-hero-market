import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import {
  deleteTimelineTemplate,
  getTimelineTemplateById,
  updateTimelineTemplate,
} from "@/lib/meet/broadcast-timeline-templates";

type Ctx = { params: Promise<{ id: string }> };

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
      { ok: false, code: BROADCAST_CODES.broadcastTimelineTemplateInvalid, error: "Invalid id" },
      { status: 400 }
    );
  }
  let body: { name?: string; templateJson?: unknown; isDefault?: boolean; hostWallet?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastTimelineTemplateInvalid, error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const host = await assertMeetBroadcastHost(userId, body.hostWallet ?? null);
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }
  const r = await updateTimelineTemplate(id, userId, {
    name: body.name,
    templateJson: body.templateJson,
    isDefault: body.isDefault,
  });
  if (!r.ok) {
    const nf = r.errors[0] === "not_found";
    return NextResponse.json(
      {
        ok: false,
        code: nf ? BROADCAST_CODES.broadcastTimelineTemplateNotFound : BROADCAST_CODES.broadcastTimelineTemplateInvalid,
        error: r.errors.join("; "),
      },
      { status: nf ? 404 : 400 }
    );
  }
  const t = await getTimelineTemplateById(id, userId);
  return NextResponse.json({ ok: true, template: t });
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
      { ok: false, code: BROADCAST_CODES.broadcastTimelineTemplateInvalid, error: "Invalid id" },
      { status: 400 }
    );
  }
  const url = new URL(req.url);
  const host = await assertMeetBroadcastHost(userId, url.searchParams.get("hostWallet"));
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }
  const ok = await deleteTimelineTemplate(id, userId);
  if (!ok) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastTimelineTemplateNotFound, error: "Not found" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
