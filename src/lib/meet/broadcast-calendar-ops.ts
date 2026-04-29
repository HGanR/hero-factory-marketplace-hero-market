import type { BroadcastEvent } from "./broadcast-events";
import { updateBroadcastEvent } from "./broadcast-event-store";
import type { BroadcastCalendarLink, BroadcastCalendarSyncMode } from "./broadcast-calendar-sync";
import { canPullFromExternalCalendar, canPushToExternalCalendar } from "./broadcast-calendar-sync";
import { touchBroadcastCalendarLinkSynced, updateBroadcastCalendarLink } from "./broadcast-calendar-link-store";
import {
  googleCalendarCreateEvent,
  googleCalendarGetEvent,
  googleCalendarUpdateEvent,
  resolveGoogleCalendarAgentContextForMeetHost,
} from "./broadcast-calendar-google-meet";

/** Fields that may be updated from an external calendar on explicit sync (never room/template/status). */
export type CalendarPullPatch = {
  title?: string;
  description?: string | null;
  scheduledStartIso?: string;
  scheduledEndIso?: string | null;
  timezone?: string | null;
};

export async function pullExternalIntoBroadcastEvent(
  userId: number,
  broadcastEventId: number,
  link: BroadcastCalendarLink
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canPullFromExternalCalendar(link.syncMode as BroadcastCalendarSyncMode)) {
    return { ok: false, error: "sync_mode_does_not_allow_pull" };
  }

  if (link.provider === "manual_external") {
    await touchBroadcastCalendarLinkSynced(broadcastEventId, userId);
    return { ok: true };
  }

  if (link.provider === "generic_ics") {
    return { ok: false, error: "ics_not_supported" };
  }

  if (link.provider !== "google_calendar") {
    return { ok: false, error: "unsupported_provider" };
  }

  const calId = link.externalCalendarId?.trim() || "primary";
  const evId = link.externalEventId?.trim();
  if (!evId) return { ok: false, error: "missing_external_event_id" };

  const ctx = await resolveGoogleCalendarAgentContextForMeetHost(userId);
  if (!ctx) {
    return { ok: false, error: "google_not_configured" };
  }

  try {
    const g = await googleCalendarGetEvent(ctx, calId, evId);
    if (!g.startIso?.trim()) {
      return { ok: false, error: "external_event_missing_start" };
    }
    const patch: CalendarPullPatch = {
      title: g.summary,
      description: g.description,
      scheduledStartIso: g.startIso,
      scheduledEndIso: g.endIso,
      timezone: g.timeZone,
    };
    const r = await updateBroadcastEvent(broadcastEventId, userId, {
      title: patch.title,
      description: patch.description,
      scheduledStartIso: patch.scheduledStartIso,
      scheduledEndIso: patch.scheduledEndIso,
      timezone: patch.timezone,
    });
    if (!r.ok) return { ok: false, error: r.errors.join("; ") };

    await updateBroadcastCalendarLink(broadcastEventId, userId, {
      externalEventUrl: g.htmlLink ?? link.externalEventUrl,
      lastSyncedAt: new Date(),
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sync_failed";
    return { ok: false, error: msg.slice(0, 300) };
  }
}

export async function pushBroadcastEventToExternalCalendar(
  userId: number,
  event: BroadcastEvent,
  link: BroadcastCalendarLink | null,
  mode: BroadcastCalendarSyncMode
): Promise<
  | { ok: true; link: { externalEventId: string; externalCalendarId: string; externalEventUrl: string | null } }
  | { ok: false; error: string }
> {
  if (!canPushToExternalCalendar(mode)) {
    return { ok: false, error: "sync_mode_does_not_allow_export" };
  }

  const ctx = await resolveGoogleCalendarAgentContextForMeetHost(userId);
  if (!ctx) {
    return { ok: false, error: "google_not_configured" };
  }

  const calId = link?.externalCalendarId?.trim() || "primary";
  const tz = event.timezone?.trim() || "UTC";
  const startIso = event.scheduledStartIso;
  const endIso =
    event.scheduledEndIso ??
    new Date(new Date(event.scheduledStartIso).getTime() + 60 * 60 * 1000).toISOString();

  try {
    if (link?.externalEventId?.trim()) {
      const u = await googleCalendarUpdateEvent(ctx, calId, link.externalEventId.trim(), {
        summary: event.title,
        description: event.description,
        startIso,
        endIso,
        timeZone: tz,
      });
      return {
        ok: true,
        link: {
          externalEventId: link.externalEventId.trim(),
          externalCalendarId: calId,
          externalEventUrl: u.htmlLink ?? link.externalEventUrl,
        },
      };
    }

    const c = await googleCalendarCreateEvent(ctx, calId, {
      summary: event.title,
      description: event.description ?? undefined,
      startIso,
      endIso,
      timeZone: tz,
    });
    return {
      ok: true,
      link: {
        externalEventId: c.eventId,
        externalCalendarId: calId,
        externalEventUrl: c.htmlLink,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "export_failed";
    return { ok: false, error: msg.slice(0, 300) };
  }
}
