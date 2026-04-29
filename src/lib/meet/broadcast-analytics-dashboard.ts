/**
 * Cross-session broadcast analytics (operational dashboard).
 * Derives aggregates from per-session facts — not a BI warehouse.
 */

import type { BroadcastTimelineEventType } from "./broadcast-timeline";
import type { MeetBroadcastSessionRow } from "@/lib/db/schema";

export const BROADCAST_ANALYTICS_DASHBOARD_MAX_CUSTOM_RANGE_DAYS = 90;
export const BROADCAST_ANALYTICS_DASHBOARD_MAX_SESSIONS = 600;
export const BROADCAST_ANALYTICS_DASHBOARD_QUERY_OVERFETCH = 900;

export type BroadcastAnalyticsRange = "last_7_days" | "last_30_days" | "custom";

export type BroadcastAnalyticsFilters = {
  dateRange: BroadcastAnalyticsRange;
  fromIso?: string;
  toIso?: string;
  compositorMode?: string;
  broadcastEventLinked?: boolean;
  calendarLinked?: boolean;
  roomId?: string;
  /** Admin-only: narrow to one host user. */
  userId?: number;
};

export type NormalizedBroadcastAnalyticsFilters = BroadcastAnalyticsFilters & {
  fromIso: string;
  toIso: string;
};

export type BroadcastAnalyticsDashboardSummary = {
  totalSessions: number;
  liveSessions: number;
  completedSessions: number;
  averageDurationSeconds: number | null;
  totalDestinationsUsed: number;
  totalFailedDestinations: number;
  degradedSessionCount: number;
  v2SessionCount: number;
  v2FallbackCount: number;
  autoDirectingApplyCount: number;
  scheduleActionCount: number;
  overlayChangeCount: number;
  liveSceneChangeCount: number;
  broadcastEventLinkedCount: number;
  calendarLinkedCount: number;
};

export type BroadcastAnalyticsBreakdowns = {
  sessionsByDay: { day: string; count: number }[];
  sessionsByCompositorMode: Record<string, number>;
  sessionsByFinalStatus: Record<string, number>;
  destinationFailuresByPlatform: Record<string, number>;
  eventLinkedVsManual: { linked: number; manual: number };
  calendarLinkedVsUnlinked: { linked: number; unlinked: number };
  autoDirectingModeUsage: Record<string, number>;
  timelineTemplateUsage: Record<string, number>;
  averageDurationByCompositorMode: Record<string, number>;
};

/** Per-session inputs for aggregation (already masked / safe for JSON). */
export type BroadcastDashboardSessionFact = {
  session: MeetBroadcastSessionRow;
  destinationCount: number;
  failedDestinationCount: number;
  failedDestinationsByPlatform: Record<string, number>;
  timelineCounts: Partial<Record<BroadcastTimelineEventType, number>>;
  broadcastEventId: number | null;
  broadcastEventTitle: string | null;
  timelineTemplateName: string | null;
  hasCalendarLink: boolean;
  autoDirectingMode: string | null;
  durationSeconds: number | null;
  anchorDayUtc: string;
};

/**
 * Parse dashboard query params. Host routes should use `allowUserIdFilter: false` so clients cannot scope other users.
 */
export function parseBroadcastAnalyticsFiltersFromSearchParams(
  sp: URLSearchParams,
  options: { allowUserIdFilter: boolean }
): { ok: true; filters: BroadcastAnalyticsFilters } | { ok: false; error: string } {
  const rangeRaw = (sp.get("range") ?? "last_30_days").trim();
  if (rangeRaw !== "last_7_days" && rangeRaw !== "last_30_days" && rangeRaw !== "custom") {
    return { ok: false, error: "invalid_range" };
  }
  const fromIso = sp.get("fromIso")?.trim() || undefined;
  const toIso = sp.get("toIso")?.trim() || undefined;
  const compositorMode = sp.get("compositorMode")?.trim() || undefined;
  const roomId = sp.get("roomId")?.trim() || undefined;
  const bel = sp.get("broadcastEventLinked");
  const broadcastEventLinked = bel === "true" ? true : bel === "false" ? false : undefined;
  const cal = sp.get("calendarLinked");
  const calendarLinked = cal === "true" ? true : cal === "false" ? false : undefined;
  let userId: number | undefined;
  if (options.allowUserIdFilter) {
    const u = sp.get("userId")?.trim();
    if (u != null && u !== "" && Number.isFinite(Number(u))) userId = Number(u);
  }
  return {
    ok: true,
    filters: {
      dateRange: rangeRaw,
      fromIso,
      toIso,
      compositorMode: compositorMode || undefined,
      broadcastEventLinked,
      calendarLinked,
      roomId: roomId || undefined,
      userId,
    },
  };
}

export function normalizeBroadcastAnalyticsFilters(
  input: BroadcastAnalyticsFilters
): { ok: true; filters: NormalizedBroadcastAnalyticsFilters } | { ok: false; error: string } {
  const now = Date.now();
  let fromMs: number;
  let toMs = now;

  if (input.dateRange === "custom") {
    if (!input.fromIso?.trim() || !input.toIso?.trim()) {
      return { ok: false, error: "custom_range_requires_from_and_to" };
    }
    fromMs = new Date(input.fromIso).getTime();
    toMs = new Date(input.toIso).getTime();
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) {
      return { ok: false, error: "invalid_custom_range" };
    }
    const spanDays = (toMs - fromMs) / (86400 * 1000);
    if (spanDays > BROADCAST_ANALYTICS_DASHBOARD_MAX_CUSTOM_RANGE_DAYS) {
      return {
        ok: false,
        error: `custom_range_exceeds_${BROADCAST_ANALYTICS_DASHBOARD_MAX_CUSTOM_RANGE_DAYS}_days`,
      };
    }
  } else if (input.dateRange === "last_7_days") {
    fromMs = now - 7 * 86400 * 1000;
  } else {
    fromMs = now - 30 * 86400 * 1000;
  }

  const fromIso = new Date(fromMs).toISOString();
  const toIso = new Date(toMs).toISOString();

  return {
    ok: true,
    filters: {
      ...input,
      fromIso,
      toIso,
    },
  };
}

function addCount(rec: Record<string, number>, key: string, n = 1): void {
  rec[key] = (rec[key] ?? 0) + n;
}

export function buildBroadcastAnalyticsDashboard(facts: BroadcastDashboardSessionFact[]): BroadcastAnalyticsDashboardSummary {
  const totalSessions = facts.length;
  let liveSessions = 0;
  let completedSessions = 0;
  let durationSum = 0;
  let durationN = 0;
  let totalDestinationsUsed = 0;
  let totalFailedDestinations = 0;
  let degradedSessionCount = 0;
  let v2SessionCount = 0;
  let v2FallbackCount = 0;
  let autoDirectingApplyCount = 0;
  let scheduleActionCount = 0;
  let overlayChangeCount = 0;
  let liveSceneChangeCount = 0;
  let broadcastEventLinkedCount = 0;
  let calendarLinkedCount = 0;

  for (const f of facts) {
    const st = f.session.status;
    if (st === "starting" || st === "active") liveSessions += 1;
    else completedSessions += 1;

    if (f.durationSeconds != null && f.session.endedAt != null) {
      durationSum += f.durationSeconds;
      durationN += 1;
    }

    totalDestinationsUsed += f.destinationCount;
    totalFailedDestinations += f.failedDestinationCount;

    if ((f.timelineCounts.degraded_entered ?? 0) > 0) degradedSessionCount += 1;

    const mode = f.session.compositorMode ?? "v1_livekit_default";
    if (mode === "v2_rendered_template") v2SessionCount += 1;
    if (f.session.compositorFallbackFromV2) v2FallbackCount += 1;

    autoDirectingApplyCount += f.timelineCounts.auto_directing_applied ?? 0;
    scheduleActionCount += f.timelineCounts.schedule_action_executed ?? 0;
    overlayChangeCount += f.timelineCounts.overlay_changed ?? 0;
    liveSceneChangeCount += f.timelineCounts.live_scene_changed ?? 0;

    if (f.broadcastEventId != null) broadcastEventLinkedCount += 1;
    if (f.hasCalendarLink) calendarLinkedCount += 1;
  }

  return {
    totalSessions,
    liveSessions,
    completedSessions,
    averageDurationSeconds: durationN > 0 ? Math.round(durationSum / durationN) : null,
    totalDestinationsUsed,
    totalFailedDestinations,
    degradedSessionCount,
    v2SessionCount,
    v2FallbackCount,
    autoDirectingApplyCount,
    scheduleActionCount,
    overlayChangeCount,
    liveSceneChangeCount,
    broadcastEventLinkedCount,
    calendarLinkedCount,
  };
}

export function buildBroadcastAnalyticsBreakdowns(facts: BroadcastDashboardSessionFact[]): BroadcastAnalyticsBreakdowns {
  const byDay = new Map<string, number>();
  const sessionsByCompositorMode: Record<string, number> = {};
  const sessionsByFinalStatus: Record<string, number> = {};
  const destinationFailuresByPlatform: Record<string, number> = {};
  let linked = 0;
  let manual = 0;
  let calLinked = 0;
  let calUnlinked = 0;
  const autoDirectingModeUsage: Record<string, number> = {};
  const timelineTemplateUsage: Record<string, number> = {};
  const durationByMode: Record<string, { sum: number; n: number }> = {};

  for (const f of facts) {
    byDay.set(f.anchorDayUtc, (byDay.get(f.anchorDayUtc) ?? 0) + 1);

    const cm = f.session.compositorMode ?? "v1_livekit_default";
    addCount(sessionsByCompositorMode, cm);
    addCount(sessionsByFinalStatus, f.session.status);

    for (const [plat, c] of Object.entries(f.failedDestinationsByPlatform)) {
      addCount(destinationFailuresByPlatform, plat, c);
    }

    if (f.broadcastEventId != null) {
      linked += 1;
      if (f.hasCalendarLink) calLinked += 1;
      else calUnlinked += 1;
    } else {
      manual += 1;
      calUnlinked += 1;
    }

    const adMode = f.autoDirectingMode ?? "none";
    addCount(autoDirectingModeUsage, adMode);

    const tmpl = f.timelineTemplateName?.trim() || "(no template)";
    addCount(timelineTemplateUsage, tmpl);

    if (f.durationSeconds != null && f.session.endedAt != null) {
      if (!durationByMode[cm]) durationByMode[cm] = { sum: 0, n: 0 };
      durationByMode[cm].sum += f.durationSeconds;
      durationByMode[cm].n += 1;
    }
  }

  const sessionsByDay = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));

  const averageDurationByCompositorMode: Record<string, number> = {};
  for (const [cm, { sum, n }] of Object.entries(durationByMode)) {
    if (n > 0) averageDurationByCompositorMode[cm] = Math.round(sum / n);
  }

  return {
    sessionsByDay,
    sessionsByCompositorMode,
    sessionsByFinalStatus,
    destinationFailuresByPlatform,
    eventLinkedVsManual: { linked, manual },
    calendarLinkedVsUnlinked: { linked: calLinked, unlinked: calUnlinked },
    autoDirectingModeUsage,
    timelineTemplateUsage,
    averageDurationByCompositorMode,
  };
}
