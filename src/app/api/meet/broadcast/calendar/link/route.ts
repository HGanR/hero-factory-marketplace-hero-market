import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { broadcastAudit } from "@/lib/meet/broadcast-audit";
import {
  incrementBroadcastCalendarImport,
  incrementBroadcastCalendarLinkCreate,
  incrementBroadcastCalendarSyncError,
} from "@/lib/meet/broadcast-metrics";
import { createBroadcastEvent, getBroadcastEventById } from "@/lib/meet/broadcast-event-store";
import {
  createBroadcastCalendarLink,
  getBroadcastCalendarLinkByBroadcastEventId,
} from "@/lib/meet/broadcast-calendar-link-store";
import {
  BROADCAST_CALENDAR_PROVIDERS,
  BROADCAST_CALENDAR_SYNC_MODES,
  validateBroadcastCalendarLink,
  type BroadcastCalendarProvider,
  type BroadcastCalendarSyncMode,
} from "@/lib/meet/broadcast-calendar-sync";
import { googleCalendarGetEvent, resolveGoogleCalendarAgentContextForMeetHost } from "@/lib/meet/broadcast-calendar-google-meet";

type CreateFromExternal = {
  provider?: unknown;
  externalCalendarId?: unknown;
  externalEventId?: unknown;
  syncMode?: unknown;
};

/**
 * POST /api/meet/broadcast/calendar/link
 * - Link existing broadcast event to external calendar row, or
 * - Import: create new broadcast event from external Google event + link.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.notAuthenticated, error: "Unauthorized" },
      { status: 401 }
    );
  }
  let body: {
    hostWallet?: string | null;
    createFromExternal?: CreateFromExternal;
    broadcastEventId?: unknown;
    provider?: unknown;
    externalCalendarId?: unknown;
    externalEventId?: unknown;
    externalEventUrl?: unknown;
    syncMode?: unknown;
    defaultRoomId?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastCalendarLinkInvalid, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const host = await assertMeetBroadcastHost(userId, body.hostWallet ?? null);
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }

  if (body.createFromExternal && typeof body.createFromExternal === "object") {
    const c = body.createFromExternal;
    const provider = c.provider === "google_calendar" ? "google_calendar" : null;
    if (!provider) {
      return NextResponse.json(
        { ok: false, code: BROADCAST_CODES.broadcastCalendarUnsupported, error: "createFromExternal supports google_calendar only in this phase" },
        { status: 400 }
      );
    }
    const extCal = typeof c.externalCalendarId === "string" ? c.externalCalendarId.trim() || "primary" : "primary";
    const extEv = typeof c.externalEventId === "string" ? c.externalEventId.trim() : "";
    if (!extEv) {
      return NextResponse.json(
        { ok: false, code: BROADCAST_CODES.broadcastCalendarLinkInvalid, error: "createFromExternal.externalEventId required" },
        { status: 400 }
      );
    }
    const syncMode: BroadcastCalendarSyncMode =
      typeof c.syncMode === "string" && BROADCAST_CALENDAR_SYNC_MODES.includes(c.syncMode as BroadcastCalendarSyncMode)
        ? (c.syncMode as BroadcastCalendarSyncMode)
        : "import_only";

    const ctx = await resolveGoogleCalendarAgentContextForMeetHost(userId);
    if (!ctx) {
      return NextResponse.json(
        {
          ok: false,
          code: BROADCAST_CODES.broadcastCalendarNotConfigured,
          error:
            "Connect Google Calendar for an AI agent you own (Agents → Google OAuth), then retry.",
        },
        { status: 400 }
      );
    }

    let g: Awaited<ReturnType<typeof googleCalendarGetEvent>>;
    try {
      g = await googleCalendarGetEvent(ctx, extCal, extEv);
    } catch (e) {
      incrementBroadcastCalendarSyncError({
        userId,
        sessionId: null,
        roomId: null,
        reason: "import_fetch_failed",
      });
      const msg = e instanceof Error ? e.message : "Failed to load external event";
      return NextResponse.json(
        { ok: false, code: BROADCAST_CODES.broadcastCalendarExternalError, error: msg.slice(0, 300) },
        { status: 502 }
      );
    }

    if (!g.startIso?.trim()) {
      return NextResponse.json(
        { ok: false, code: BROADCAST_CODES.broadcastCalendarExternalError, error: "External event has no start time" },
        { status: 400 }
      );
    }

    const defaultRoom =
      typeof body.defaultRoomId === "string" && body.defaultRoomId.trim() ? body.defaultRoomId.trim() : null;

    const cr = await createBroadcastEvent(userId, {
      title: g.summary,
      description: g.description,
      scheduledStartIso: g.startIso,
      scheduledEndIso: g.endIso ?? undefined,
      timezone: g.timeZone,
      roomId: defaultRoom,
      status: "draft",
    });
    if (!cr.ok) {
      return NextResponse.json(
        { ok: false, code: BROADCAST_CODES.broadcastEventInvalid, error: cr.errors.join("; ") },
        { status: 400 }
      );
    }

    const ins = await createBroadcastCalendarLink({
      userId,
      broadcastEventId: cr.id,
      provider: "google_calendar",
      externalCalendarId: extCal,
      externalEventId: extEv,
      externalEventUrl: g.htmlLink,
      syncMode,
    });
    if (!ins.ok) {
      return NextResponse.json(
        { ok: false, code: BROADCAST_CODES.broadcastCalendarLinkInvalid, error: "Could not create calendar link" },
        { status: 503 }
      );
    }

    incrementBroadcastCalendarImport({ userId, sessionId: null, roomId: defaultRoom });
    incrementBroadcastCalendarLinkCreate({ userId, sessionId: null, roomId: defaultRoom });
    broadcastAudit("broadcast_calendar_imported", { userId, broadcastEventId: cr.id, provider: "google_calendar" });
    broadcastAudit("broadcast_calendar_link_created", { userId, broadcastEventId: cr.id, provider: "google_calendar" });
    return NextResponse.json({ ok: true, broadcastEventId: cr.id, linkId: ins.id });
  }

  const v = validateBroadcastCalendarLink({
    provider: body.provider,
    syncMode: body.syncMode,
    externalCalendarId: body.externalCalendarId,
    externalEventId: body.externalEventId,
    externalEventUrl: body.externalEventUrl,
    broadcastEventId: body.broadcastEventId,
  });
  if (!v.ok) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastCalendarLinkInvalid, error: v.errors.join("; ") },
      { status: 400 }
    );
  }

  const broadcastEventId = Number(body.broadcastEventId);
  const provider = body.provider as BroadcastCalendarProvider;
  const syncMode = body.syncMode as BroadcastCalendarSyncMode;

  const ev = await getBroadcastEventById(broadcastEventId, userId);
  if (!ev) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastEventNotFound, error: "Broadcast event not found" },
      { status: 404 }
    );
  }

  const existing = await getBroadcastCalendarLinkByBroadcastEventId(broadcastEventId, userId);
  if (existing) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastCalendarSyncConflict, error: "Event already has a calendar link; unlink first." },
      { status: 409 }
    );
  }

  const extCal =
    typeof body.externalCalendarId === "string" && body.externalCalendarId.trim()
      ? body.externalCalendarId.trim()
      : provider === "google_calendar"
        ? "primary"
        : null;
  const extEv = typeof body.externalEventId === "string" && body.externalEventId.trim() ? body.externalEventId.trim() : null;
  const extUrl = typeof body.externalEventUrl === "string" && body.externalEventUrl.trim() ? body.externalEventUrl.trim() : null;

  if (provider === "google_calendar" && !extEv) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastCalendarLinkInvalid, error: "externalEventId required for google_calendar" },
      { status: 400 }
    );
  }

  const ins = await createBroadcastCalendarLink({
    userId,
    broadcastEventId,
    provider,
    externalCalendarId: extCal,
    externalEventId: extEv,
    externalEventUrl: extUrl,
    syncMode,
  });
  if (!ins.ok) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastCalendarLinkInvalid, error: "Could not create link" },
      { status: 503 }
    );
  }

  incrementBroadcastCalendarLinkCreate({ userId, sessionId: null, roomId: ev.roomId });
  broadcastAudit("broadcast_calendar_link_created", { userId, broadcastEventId, provider });
  return NextResponse.json({ ok: true, linkId: ins.id });
}
