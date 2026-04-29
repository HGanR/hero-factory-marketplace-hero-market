/**
 * Calendar link model for broadcast events. Sync is explicit user-driven only (no background worker).
 * App-owned fields (roomId, scenePresetId, defaultTimelineTemplateId, status) are never overwritten by calendar pull.
 */

export const BROADCAST_CALENDAR_PROVIDERS = ["google_calendar", "generic_ics", "manual_external"] as const;
export type BroadcastCalendarProvider = (typeof BROADCAST_CALENDAR_PROVIDERS)[number];

export const BROADCAST_CALENDAR_SYNC_MODES = [
  "import_only",
  "linked_readonly",
  "linked_bidirectional_prepare",
  "export_only",
] as const;
export type BroadcastCalendarSyncMode = (typeof BROADCAST_CALENDAR_SYNC_MODES)[number];

export type BroadcastCalendarLink = {
  id: number;
  userId: number;
  broadcastEventId: number;
  provider: BroadcastCalendarProvider;
  externalCalendarId: string | null;
  externalEventId: string | null;
  externalEventUrl: string | null;
  syncMode: BroadcastCalendarSyncMode;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Safe subset for API / prepare-launch / admin (no tokens). */
export type BroadcastCalendarLinkSummary = {
  provider: BroadcastCalendarProvider;
  syncMode: BroadcastCalendarSyncMode;
  externalEventUrl: string | null;
  externalCalendarId: string | null;
  externalEventId: string | null;
  lastSyncedAt: string | null;
};

export function toBroadcastCalendarLinkSummary(link: BroadcastCalendarLink): BroadcastCalendarLinkSummary {
  return {
    provider: link.provider,
    syncMode: link.syncMode,
    externalEventUrl: link.externalEventUrl,
    externalCalendarId: link.externalCalendarId,
    externalEventId: link.externalEventId,
    lastSyncedAt: link.lastSyncedAt,
  };
}

export function canPullFromExternalCalendar(mode: BroadcastCalendarSyncMode): boolean {
  return mode === "import_only" || mode === "linked_readonly" || mode === "linked_bidirectional_prepare";
}

export function canPushToExternalCalendar(mode: BroadcastCalendarSyncMode): boolean {
  return mode === "export_only" || mode === "linked_bidirectional_prepare";
}

export function validateBroadcastCalendarLink(input: {
  provider: unknown;
  syncMode: unknown;
  externalCalendarId?: unknown;
  externalEventId?: unknown;
  externalEventUrl?: unknown;
  broadcastEventId?: unknown;
}): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (typeof input.provider !== "string" || !BROADCAST_CALENDAR_PROVIDERS.includes(input.provider as BroadcastCalendarProvider)) {
    errors.push("invalid provider");
  }
  if (typeof input.syncMode !== "string" || !BROADCAST_CALENDAR_SYNC_MODES.includes(input.syncMode as BroadcastCalendarSyncMode)) {
    errors.push("invalid syncMode");
  }
  const provider = input.provider as BroadcastCalendarProvider;
  if (provider === "manual_external") {
    if (typeof input.externalEventUrl !== "string" || !input.externalEventUrl.trim()) {
      errors.push("manual_external requires externalEventUrl");
    }
  }
  if (provider === "google_calendar") {
    if (input.externalEventId != null && typeof input.externalEventId !== "string") errors.push("invalid externalEventId");
    if (input.externalCalendarId != null && typeof input.externalCalendarId !== "string") errors.push("invalid externalCalendarId");
  }
  if (input.broadcastEventId != null) {
    const n = Number(input.broadcastEventId);
    if (!Number.isFinite(n) || n <= 0) errors.push("invalid broadcastEventId");
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function canSyncBroadcastEventWithCalendar(mode: BroadcastCalendarSyncMode): {
  pull: boolean;
  push: boolean;
} {
  return { pull: canPullFromExternalCalendar(mode), push: canPushToExternalCalendar(mode) };
}

export function summarizeCalendarLink(link: BroadcastCalendarLinkSummary): string {
  const p = link.provider.replace(/_/g, " ");
  const url = link.externalEventUrl ? " · has link" : "";
  return `${p} (${link.syncMode})${url}`;
}
