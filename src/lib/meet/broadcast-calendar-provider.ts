/**
 * Calendar source abstraction for meet broadcast. Google uses agent-plugin OAuth; ICS is a stub; manual is URL-only.
 */

import type { BroadcastCalendarProvider } from "./broadcast-calendar-sync";
import {
  googleCalendarGetEvent,
  googleCalendarListUpcoming,
  resolveGoogleCalendarAgentContextForMeetHost,
  type GoogleCalendarListItem,
} from "./broadcast-calendar-google-meet";

export type ExternalCalendarCandidate = {
  provider: BroadcastCalendarProvider;
  externalCalendarId: string;
  externalEventId: string;
  title: string;
  startIso: string;
  endIso: string;
  htmlLink?: string;
};

export type ListExternalCandidatesResult =
  | { ok: true; events: ExternalCalendarCandidate[]; setupHint?: string }
  | { ok: false; code: "not_configured" | "unsupported" | "external_error"; message: string };

export async function listUpcomingExternalCalendarEvents(
  userId: number,
  options: { provider: BroadcastCalendarProvider; days?: number; calendarId?: string; maxResults?: number }
): Promise<ListExternalCandidatesResult> {
  const days = Math.min(90, Math.max(1, options.days ?? 14));
  const maxResults = Math.min(50, Math.max(1, options.maxResults ?? 25));
  const calendarId = (options.calendarId ?? "primary").trim() || "primary";

  if (options.provider === "generic_ics") {
    return {
      ok: false,
      code: "unsupported",
      message: "ICS URL import is not implemented in this phase.",
    };
  }
  if (options.provider === "manual_external") {
    return { ok: true, events: [], setupHint: "Manual links use a pasted URL when linking a broadcast event." };
  }

  if (options.provider !== "google_calendar") {
    return { ok: false, code: "unsupported", message: "Unknown calendar provider." };
  }

  const ctx = await resolveGoogleCalendarAgentContextForMeetHost(userId);
  if (!ctx) {
    return {
      ok: false,
      code: "not_configured",
      message:
        "No Google Calendar connection found. Connect Google for an AI agent you own (Workspace → Agents → Google), then try again.",
    };
  }

  const now = Date.now();
  const timeMinIso = new Date(now).toISOString();
  const timeMaxIso = new Date(now + days * 86400000).toISOString();

  try {
    const items = await googleCalendarListUpcoming(ctx, calendarId, { timeMinIso, timeMaxIso, maxResults });
    const events: ExternalCalendarCandidate[] = items.map((e: GoogleCalendarListItem) => ({
      provider: "google_calendar" as const,
      externalCalendarId: calendarId,
      externalEventId: e.id,
      title: e.summary,
      startIso: e.startIso,
      endIso: e.endIso,
      htmlLink: e.htmlLink,
    }));
    return { ok: true, events };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Calendar request failed";
    return { ok: false, code: "external_error", message: msg.slice(0, 300) };
  }
}

export function buildExternalDeepLink(
  provider: BroadcastCalendarProvider,
  externalEventUrl: string | null,
  _externalEventId: string | null
): string | null {
  if (externalEventUrl?.trim()) return externalEventUrl.trim();
  if (provider === "manual_external") return null;
  return null;
}
