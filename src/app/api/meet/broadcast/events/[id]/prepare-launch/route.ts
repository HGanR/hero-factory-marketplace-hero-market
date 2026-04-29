import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { prepareBroadcastEventLaunch, type PrepareLaunchOverrides } from "@/lib/meet/broadcast-event-store";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/meet/broadcast/events/[id]/prepare-launch
 * Body: { hostWallet? } — returns resolved launch hints (no egress, no DB mutation).
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
      { ok: false, code: BROADCAST_CODES.broadcastEventInvalid, error: "Invalid id" },
      { status: 400 }
    );
  }
  let hostWallet: string | null = null;
  let overrides: PrepareLaunchOverrides | undefined;
  try {
    const b = (await req.json()) as {
      hostWallet?: string | null;
      roomId?: string | null;
      scenePresetId?: number | null;
      defaultTimelineTemplateId?: number | null;
    };
    hostWallet = b.hostWallet ?? null;
    if (b.roomId !== undefined || b.scenePresetId !== undefined || b.defaultTimelineTemplateId !== undefined) {
      overrides = {
        ...(b.roomId !== undefined ? { roomId: b.roomId } : {}),
        ...(b.scenePresetId !== undefined ? { scenePresetId: b.scenePresetId } : {}),
        ...(b.defaultTimelineTemplateId !== undefined ? { defaultTimelineTemplateId: b.defaultTimelineTemplateId } : {}),
      };
    }
  } catch {
    hostWallet = null;
  }
  const host = await assertMeetBroadcastHost(userId, hostWallet);
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }

  const r = await prepareBroadcastEventLaunch(userId, id, overrides);
  if (!r.ok) {
    const notFound = r.errors.includes("event_not_found");
    return NextResponse.json(
      { ok: false, code: notFound ? BROADCAST_CODES.broadcastEventNotFound : BROADCAST_CODES.broadcastEventInvalid, error: r.errors.join("; ") },
      { status: notFound ? 404 : 400 }
    );
  }
  const c = r.config;
  return NextResponse.json({
    ok: true,
    launchConfig: {
      roomId: c.roomId,
      scenePresetId: c.scenePresetId,
      scenePresetName: c.scenePresetName,
      sceneSnapshot: c.sceneSnapshot,
      timelineTemplateId: c.timelineTemplateId,
      timelineTemplateName: c.timelineTemplateName,
      schedulePreview: c.schedulePreview,
      appliedShowPackageId: c.appliedShowPackageId,
      showPackageSummary: c.showPackageSummary,
      overlayPackSummary: c.overlayPackSummary,
      guestCardPackSummary: c.guestCardPackSummary,
      defaultBrandingJson: c.defaultBrandingJson,
      event: {
        id: c.event.id,
        title: c.event.title,
        scheduledStartIso: c.event.scheduledStartIso,
        status: c.event.status,
        showPackageId: c.event.showPackageId,
      },
      calendarLink: c.calendarLink,
    },
  });
}
