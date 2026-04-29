import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { listUpcomingExternalCalendarEvents } from "@/lib/meet/broadcast-calendar-provider";
import type { BroadcastCalendarProvider } from "@/lib/meet/broadcast-calendar-sync";
import { BROADCAST_CALENDAR_PROVIDERS } from "@/lib/meet/broadcast-calendar-sync";

/**
 * GET /api/meet/broadcast/calendar/events?hostWallet=&provider=google_calendar&days=14&calendarId=primary
 */
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

  const pRaw = req.nextUrl.searchParams.get("provider")?.trim() ?? "google_calendar";
  if (!BROADCAST_CALENDAR_PROVIDERS.includes(pRaw as BroadcastCalendarProvider)) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastCalendarUnsupported, error: "Invalid provider" },
      { status: 400 }
    );
  }
  const provider = pRaw as BroadcastCalendarProvider;
  const days = Number(req.nextUrl.searchParams.get("days") ?? "14");
  const calendarId = req.nextUrl.searchParams.get("calendarId")?.trim() || undefined;

  const r = await listUpcomingExternalCalendarEvents(userId, { provider, days, calendarId });
  if (!r.ok) {
    const code =
      r.code === "not_configured"
        ? BROADCAST_CODES.broadcastCalendarNotConfigured
        : r.code === "unsupported"
          ? BROADCAST_CODES.broadcastCalendarUnsupported
          : BROADCAST_CODES.broadcastCalendarExternalError;
    const status = r.code === "external_error" ? 502 : 400;
    return NextResponse.json({ ok: false, code, error: r.message }, { status });
  }

  return NextResponse.json({
    ok: true,
    events: r.events,
    setupHint: r.setupHint,
  });
}
