import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { getDb } from "@/lib/db";
import { meetBroadcastSessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildBroadcastSessionAnalyticsSummary } from "@/lib/meet/broadcast-analytics";
import { getBroadcastEventById } from "@/lib/meet/broadcast-event-store";
import { getBroadcastShowPackageById } from "@/lib/meet/broadcast-show-package-store";
import { getTimelineTemplateById } from "@/lib/meet/broadcast-timeline-templates";
import { toBroadcastCalendarLinkSummary } from "@/lib/meet/broadcast-calendar-sync";
import { getBroadcastCalendarLinkByBroadcastEventId } from "@/lib/meet/broadcast-calendar-link-store";

/**
 * GET /api/meet/broadcast/analytics?broadcastSessionId=&hostWallet=
 * Operational summary for one session (owner only).
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.notAuthenticated, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const sidRaw = req.nextUrl.searchParams.get("broadcastSessionId")?.trim() ?? "";
  const broadcastSessionId = Number(sidRaw);
  if (!Number.isFinite(broadcastSessionId) || broadcastSessionId <= 0) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.scheduleInvalid, error: "Invalid broadcastSessionId" },
      { status: 400 }
    );
  }

  const host = await assertMeetBroadcastHost(userId, req.nextUrl.searchParams.get("hostWallet"));
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastSessions)
    .where(eq(meetBroadcastSessions.id, broadcastSessionId))
    .limit(1);
  const session = rows[0];
  if (!session) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastAnalyticsNotFound, error: "Session not found" },
      { status: 404 }
    );
  }
  if (session.userId !== userId) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastAnalyticsForbidden, error: "Not allowed" },
      { status: 403 }
    );
  }

  let broadcastEventTitle: string | null = null;
  let timelineTemplateName: string | null = null;
  let showPackageId: number | null = null;
  let showPackageName: string | null = null;
  let calendarLink = null as ReturnType<typeof toBroadcastCalendarLinkSummary> | null;
  const beId = session.broadcastEventId;
  if (beId != null && Number.isFinite(Number(beId))) {
    const ev = await getBroadcastEventById(Number(beId), userId);
    if (ev) {
      broadcastEventTitle = ev.title;
      if (ev.defaultTimelineTemplateId != null) {
        const tt = await getTimelineTemplateById(ev.defaultTimelineTemplateId, userId);
        timelineTemplateName = tt?.name ?? null;
      }
      if (ev.showPackageId != null && Number.isFinite(Number(ev.showPackageId))) {
        showPackageId = Number(ev.showPackageId);
        const sp = await getBroadcastShowPackageById(showPackageId, userId);
        showPackageName = sp?.name ?? null;
      }
      const cal = await getBroadcastCalendarLinkByBroadcastEventId(ev.id, userId);
      calendarLink = cal ? toBroadcastCalendarLinkSummary(cal) : null;
    }
  }

  const analytics = await buildBroadcastSessionAnalyticsSummary(session, {
    broadcastEventTitle,
    showPackageId,
    showPackageName,
    timelineTemplateName,
    calendarLink,
  });

  return NextResponse.json({ ok: true, analytics });
}
