import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { createTimelineTemplate, listTimelineTemplatesForUser } from "@/lib/meet/broadcast-timeline-templates";

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
  const rows = await listTimelineTemplatesForUser(userId);
  return NextResponse.json({
    ok: true,
    templates: rows.map((t) => ({
      id: t.id,
      name: t.name,
      template: t.template,
      isDefault: t.isDefault,
      createdAtIso: t.createdAtIso,
      updatedAtIso: t.updatedAtIso,
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
  let body: { name?: unknown; templateJson?: unknown; hostWallet?: string | null };
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
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastTimelineTemplateInvalid, error: "name required" },
      { status: 400 }
    );
  }
  const r = await createTimelineTemplate({ userId, name, templateJson: body.templateJson });
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastTimelineTemplateInvalid, error: r.errors.join("; ") },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, id: r.id });
}
