import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { broadcastAudit } from "@/lib/meet/broadcast-audit";
import {
  incrementBroadcastCalendarExport,
  incrementBroadcastCalendarLinkCreate,
  incrementBroadcastCalendarSyncError,
} from "@/lib/meet/broadcast-metrics";
import { getBroadcastEventById } from "@/lib/meet/broadcast-event-store";
import {
  createBroadcastCalendarLink,
  getBroadcastCalendarLinkByBroadcastEventId,
  updateBroadcastCalendarLink,
} from "@/lib/meet/broadcast-calendar-link-store";
import { pushBroadcastEventToExternalCalendar } from "@/lib/meet/broadcast-calendar-ops";
import {
  BROADCAST_CALENDAR_SYNC_MODES,
  canPushToExternalCalendar,
  type BroadcastCalendarSyncMode,
} from "@/lib/meet/broadcast-calendar-sync";

/**
 * POST /api/meet/broadcast/calendar/export
 * Body: { broadcastEventId, hostWallet?, syncMode? } — push broadcast metadata to Google Calendar (explicit).
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.notAuthenticated, error: "Unauthorized" },
      { status: 401 }
    );
  }
  let body: { broadcastEventId?: unknown; hostWallet?: string | null; syncMode?: unknown };
  try {
    body = (await req.json()) as { broadcastEventId?: unknown; hostWallet?: string | null; syncMode?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastCalendarLinkInvalid, error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const eid = Number(body.broadcastEventId);
  if (!Number.isFinite(eid) || eid <= 0) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastCalendarLinkInvalid, error: "broadcastEventId required" },
      { status: 400 }
    );
  }
  const host = await assertMeetBroadcastHost(userId, body.hostWallet ?? null);
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }

  const event = await getBroadcastEventById(eid, userId);
  if (!event) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastEventNotFound, error: "Broadcast event not found" },
      { status: 404 }
    );
  }

  const link = await getBroadcastCalendarLinkByBroadcastEventId(eid, userId);
  if (link && link.provider === "manual_external") {
    return NextResponse.json(
      {
        ok: false,
        code: BROADCAST_CODES.broadcastCalendarSyncConflict,
        error: "Manual URL link cannot export to Google — unlink or use a Google-backed link.",
      },
      { status: 409 }
    );
  }

  let mode: BroadcastCalendarSyncMode;
  if (
    typeof body.syncMode === "string" &&
    BROADCAST_CALENDAR_SYNC_MODES.includes(body.syncMode as BroadcastCalendarSyncMode)
  ) {
    mode = body.syncMode as BroadcastCalendarSyncMode;
  } else if (link) {
    mode = link.syncMode as BroadcastCalendarSyncMode;
  } else {
    mode = "export_only";
  }

  if (!canPushToExternalCalendar(mode)) {
    return NextResponse.json(
      {
        ok: false,
        code: BROADCAST_CODES.broadcastCalendarSyncConflict,
        error:
          "Sync mode does not allow export. Use export_only or linked_bidirectional_prepare (or pass syncMode in the body).",
      },
      { status: 409 }
    );
  }

  const r = await pushBroadcastEventToExternalCalendar(userId, event, link, mode);
  if (!r.ok) {
    incrementBroadcastCalendarSyncError({ userId, sessionId: null, roomId: null, reason: r.error.slice(0, 120) });
    const isConfig = r.error === "google_not_configured";
    return NextResponse.json(
      {
        ok: false,
        code: isConfig ? BROADCAST_CODES.broadcastCalendarNotConfigured : BROADCAST_CODES.broadcastCalendarExternalError,
        error: r.error,
      },
      { status: isConfig ? 400 : 502 }
    );
  }

  if (link) {
    await updateBroadcastCalendarLink(eid, userId, {
      externalEventId: r.link.externalEventId,
      externalCalendarId: r.link.externalCalendarId,
      externalEventUrl: r.link.externalEventUrl,
      lastSyncedAt: new Date(),
    });
  } else {
    const ins = await createBroadcastCalendarLink({
      userId,
      broadcastEventId: eid,
      provider: "google_calendar",
      externalCalendarId: r.link.externalCalendarId,
      externalEventId: r.link.externalEventId,
      externalEventUrl: r.link.externalEventUrl,
      syncMode: "export_only",
    });
    if (!ins.ok) {
      incrementBroadcastCalendarSyncError({ userId, sessionId: null, roomId: null, reason: "link_insert_failed" });
      return NextResponse.json(
        { ok: false, code: BROADCAST_CODES.broadcastCalendarLinkInvalid, error: "Could not save calendar link after export" },
        { status: 503 }
      );
    }
    incrementBroadcastCalendarLinkCreate({ userId, sessionId: null, roomId: event.roomId });
  }

  incrementBroadcastCalendarExport({ userId, sessionId: null, roomId: event.roomId });
  broadcastAudit("broadcast_calendar_exported", { userId, broadcastEventId: eid });
  return NextResponse.json({ ok: true, externalEventId: r.link.externalEventId, externalEventUrl: r.link.externalEventUrl });
}
