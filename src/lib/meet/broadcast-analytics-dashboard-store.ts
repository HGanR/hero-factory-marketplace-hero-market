/**
 * Data layer for cross-session broadcast analytics dashboard.
 * Bounded queries; uses existing session / timeline / destination tables.
 */

import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  meetBroadcastAutoDirectingStates,
  meetBroadcastSessionDestinations,
  meetBroadcastSessions,
  type MeetBroadcastSessionDestinationRow,
  type MeetBroadcastSessionRow,
} from "@/lib/db/schema";
import {
  BROADCAST_ANALYTICS_DASHBOARD_MAX_SESSIONS,
  BROADCAST_ANALYTICS_DASHBOARD_QUERY_OVERFETCH,
  buildBroadcastAnalyticsBreakdowns,
  buildBroadcastAnalyticsDashboard,
  type BroadcastAnalyticsBreakdowns,
  type BroadcastAnalyticsDashboardSummary,
  type BroadcastDashboardSessionFact,
  type NormalizedBroadcastAnalyticsFilters,
} from "./broadcast-analytics-dashboard";
import type { BroadcastCalendarLink } from "./broadcast-calendar-sync";
import type { BroadcastEvent } from "./broadcast-events";
import { getBroadcastCalendarLinksByBroadcastEventIds, getBroadcastCalendarLinksByBroadcastEventIdsUnscoped } from "./broadcast-calendar-link-store";
import { listBroadcastEventsByIdsForUser, listBroadcastEventsByIdsInternal } from "./broadcast-event-store";
import type { BroadcastTimelineEventType } from "./broadcast-timeline";
import { getTimelineTypeCountsForSessions } from "./broadcast-timeline-store";
import type { BroadcastTimelineTemplateRow } from "./broadcast-timeline-templates";
import { listTimelineTemplatesByIdsForUser, listTimelineTemplatesByIdsInternal } from "./broadcast-timeline-templates";

const IN_CHUNK = 250;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function queryBroadcastSessionsForAnalytics(
  userId: number | undefined,
  filters: NormalizedBroadcastAnalyticsFilters,
  limit = BROADCAST_ANALYTICS_DASHBOARD_QUERY_OVERFETCH
): Promise<MeetBroadcastSessionRow[]> {
  return fetchBroadcastSessionsForDashboard({ userId, filters, limit });
}

async function fetchBroadcastSessionsForDashboard(params: {
  userId?: number;
  filters: NormalizedBroadcastAnalyticsFilters;
  limit: number;
}): Promise<MeetBroadcastSessionRow[]> {
  const { userId, filters, limit } = params;
  const db = await getDb();
  const from = new Date(filters.fromIso);
  const to = new Date(filters.toIso);

  const anchor = sql`COALESCE(${meetBroadcastSessions.startedAt}, ${meetBroadcastSessions.createdAt})`;

  const conditions: SQL[] = [gte(anchor, from), lte(anchor, to)];
  if (userId != null) {
    conditions.push(eq(meetBroadcastSessions.userId, userId));
  }
  const room = filters.roomId?.trim();
  if (room) conditions.push(eq(meetBroadcastSessions.roomId, room));
  const comp = filters.compositorMode?.trim();
  if (comp) conditions.push(eq(meetBroadcastSessions.compositorMode, comp));
  if (filters.broadcastEventLinked === true) conditions.push(isNotNull(meetBroadcastSessions.broadcastEventId));
  if (filters.broadcastEventLinked === false) conditions.push(isNull(meetBroadcastSessions.broadcastEventId));

  return db
    .select()
    .from(meetBroadcastSessions)
    .where(and(...conditions))
    .orderBy(desc(meetBroadcastSessions.updatedAt))
    .limit(Math.min(BROADCAST_ANALYTICS_DASHBOARD_QUERY_OVERFETCH, Math.max(1, limit)));
}

export async function queryDestinationsForSessionIds(sessionIds: number[]): Promise<MeetBroadcastSessionDestinationRow[]> {
  const unique = [...new Set(sessionIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (unique.length === 0) return [];
  const db = await getDb();
  const out: MeetBroadcastSessionDestinationRow[] = [];
  for (const part of chunk(unique, IN_CHUNK)) {
    const rows = await db
      .select()
      .from(meetBroadcastSessionDestinations)
      .where(inArray(meetBroadcastSessionDestinations.broadcastSessionId, part));
    out.push(...rows);
  }
  return out;
}

/** Timeline aggregates grouped by session (types used for dashboard counters). */
export async function queryBroadcastTimelineEventsForAnalytics(
  sessionIds: number[]
): Promise<Map<number, Partial<Record<BroadcastTimelineEventType, number>>>> {
  return getTimelineTypeCountsForSessions(sessionIds);
}

/** Resolve calendar link presence for broadcast event ids (host-scoped). */
export async function queryCalendarLinksForAnalytics(
  userId: number,
  eventIds: number[]
): Promise<Map<number, BroadcastCalendarLink>> {
  return getBroadcastCalendarLinksByBroadcastEventIds(userId, eventIds);
}

/** Session rows → distinct broadcast_event_id values (for linking analytics). */
export function queryBroadcastEventLinksForAnalytics(sessionRows: MeetBroadcastSessionRow[]): number[] {
  return [
    ...new Set(
      sessionRows.map((s) => s.broadcastEventId).filter((id): id is number => id != null && Number.isFinite(Number(id)))
    ),
  ];
}

export type DashboardBuildResult = {
  summary: BroadcastAnalyticsDashboardSummary;
  breakdowns: BroadcastAnalyticsBreakdowns;
  filtersApplied: NormalizedBroadcastAnalyticsFilters;
  generatedAt: string;
  sessionsTruncated: boolean;
  sessionSampleSize: number;
  recentSessions: Array<{
    sessionId: number;
    roomId: string;
    userId: number;
    startedAt: string | null;
    endedAt: string | null;
    finalStatus: string;
    broadcastEventId: number | null;
    compositorMode: string;
  }>;
};

async function loadAutoDirectingModesForSessions(
  sessionIds: number[]
): Promise<Map<number, string | null>> {
  const map = new Map<number, string | null>();
  const unique = [...new Set(sessionIds)];
  if (unique.length === 0) return map;
  const db = await getDb();
  for (const part of chunk(unique, IN_CHUNK)) {
    const rows = await db
      .select()
      .from(meetBroadcastAutoDirectingStates)
      .where(inArray(meetBroadcastAutoDirectingStates.broadcastSessionId, part));
    for (const r of rows) {
      const json = r.directingStateJson as { policy?: { mode?: string } } | null;
      const mode = json?.policy?.mode?.trim() || null;
      map.set(r.broadcastSessionId, mode);
    }
  }
  return map;
}

function sessionAnchorDayUtc(s: MeetBroadcastSessionRow): string {
  const t = s.startedAt ?? s.createdAt;
  const d = t ? new Date(t) : new Date();
  return d.toISOString().slice(0, 10);
}

function durationSecondsForSession(s: MeetBroadcastSessionRow): number | null {
  const started = s.startedAt ? new Date(s.startedAt).getTime() : null;
  if (started == null) return null;
  const ended = s.endedAt ? new Date(s.endedAt).getTime() : null;
  const endMs = ended ?? Date.now();
  return Math.max(0, Math.round((endMs - started) / 1000));
}

async function buildFactsForSessions(
  sessions: MeetBroadcastSessionRow[],
  scope: { kind: "user"; userId: number } | { kind: "admin" }
): Promise<BroadcastDashboardSessionFact[]> {
  const ids = sessions.map((s) => s.id);
  const [destRows, timelineMap, adModes] = await Promise.all([
    queryDestinationsForSessionIds(ids),
    getTimelineTypeCountsForSessions(ids),
    loadAutoDirectingModesForSessions(ids),
  ]);

  const destBySession = new Map<number, MeetBroadcastSessionDestinationRow[]>();
  for (const d of destRows) {
    const sid = d.broadcastSessionId;
    let arr = destBySession.get(sid);
    if (!arr) {
      arr = [];
      destBySession.set(sid, arr);
    }
    arr.push(d);
  }

  const eventIds = [
    ...new Set(
      sessions.map((s) => s.broadcastEventId).filter((id): id is number => id != null && Number.isFinite(Number(id)))
    ),
  ];

  let eventMap: Map<number, BroadcastEvent>;
  let templateMap: Map<number, BroadcastTimelineTemplateRow>;
  let calendarMap: Map<number, BroadcastCalendarLink>;

  if (scope.kind === "user") {
    const [ev, cal] = await Promise.all([
      listBroadcastEventsByIdsForUser(scope.userId, eventIds),
      getBroadcastCalendarLinksByBroadcastEventIds(scope.userId, eventIds),
    ]);
    eventMap = ev;
    calendarMap = cal;
    const templateIds = [...new Set([...ev.values()].map((e) => e.defaultTimelineTemplateId).filter((x): x is number => x != null))];
    templateMap = await listTimelineTemplatesByIdsForUser(scope.userId, templateIds);
  } else {
    const [ev, cal] = await Promise.all([
      listBroadcastEventsByIdsInternal(eventIds),
      getBroadcastCalendarLinksByBroadcastEventIdsUnscoped(eventIds),
    ]);
    eventMap = ev;
    calendarMap = cal;
    const templateIds = [...new Set([...ev.values()].map((e) => e.defaultTimelineTemplateId).filter((x): x is number => x != null))];
    templateMap = await listTimelineTemplatesByIdsInternal(templateIds);
  }

  const facts: BroadcastDashboardSessionFact[] = [];
  for (const s of sessions) {
    const dests = destBySession.get(s.id) ?? [];
    const failed = dests.filter((d) => d.status === "failed");
    const failedByPlatform: Record<string, number> = {};
    for (const d of failed) {
      const p = d.platform || "unknown";
      failedByPlatform[p] = (failedByPlatform[p] ?? 0) + 1;
    }

    const beId = s.broadcastEventId ?? null;
    const ev = beId != null ? eventMap.get(beId) : undefined;
    const templateId = ev?.defaultTimelineTemplateId ?? null;
    const templateName = templateId != null ? templateMap.get(templateId)?.name ?? null : null;
    const hasCal = beId != null ? calendarMap.has(beId) : false;

    facts.push({
      session: s,
      destinationCount: dests.length,
      failedDestinationCount: failed.length,
      failedDestinationsByPlatform: failedByPlatform,
      timelineCounts: timelineMap.get(s.id) ?? {},
      broadcastEventId: beId,
      broadcastEventTitle: ev?.title ?? null,
      timelineTemplateName: templateName,
      hasCalendarLink: hasCal,
      autoDirectingMode: adModes.get(s.id) ?? null,
      durationSeconds: durationSecondsForSession(s),
      anchorDayUtc: sessionAnchorDayUtc(s),
    });
  }

  return facts;
}

function applyCalendarLinkedFilter(
  facts: BroadcastDashboardSessionFact[],
  calendarLinked: boolean | undefined
): BroadcastDashboardSessionFact[] {
  if (calendarLinked === undefined) return facts;
  return facts.filter((f) => (calendarLinked ? f.hasCalendarLink : !f.hasCalendarLink));
}

export async function buildDashboardDataForUser(
  userId: number,
  filters: NormalizedBroadcastAnalyticsFilters
): Promise<DashboardBuildResult> {
  const generatedAt = new Date().toISOString();
  let sessions = await fetchBroadcastSessionsForDashboard({
    userId,
    filters,
    limit: BROADCAST_ANALYTICS_DASHBOARD_QUERY_OVERFETCH,
  });

  let facts = await buildFactsForSessions(sessions, { kind: "user", userId });
  facts = applyCalendarLinkedFilter(facts, filters.calendarLinked);

  const truncatedBefore = facts.length > BROADCAST_ANALYTICS_DASHBOARD_MAX_SESSIONS;
  facts = facts.slice(0, BROADCAST_ANALYTICS_DASHBOARD_MAX_SESSIONS);

  const summary = buildBroadcastAnalyticsDashboard(facts);
  const breakdowns = buildBroadcastAnalyticsBreakdowns(facts);

  const recentSessions = facts.slice(0, 15).map((f) => ({
    sessionId: f.session.id,
    roomId: f.session.roomId,
    userId: f.session.userId,
    startedAt: f.session.startedAt ? new Date(f.session.startedAt).toISOString() : null,
    endedAt: f.session.endedAt ? new Date(f.session.endedAt).toISOString() : null,
    finalStatus: f.session.status,
    broadcastEventId: f.broadcastEventId,
    compositorMode: f.session.compositorMode ?? "v1_livekit_default",
  }));

  return {
    summary,
    breakdowns,
    filtersApplied: filters,
    generatedAt,
    sessionsTruncated: truncatedBefore,
    sessionSampleSize: facts.length,
    recentSessions,
  };
}

export async function buildDashboardDataForAdmin(filters: NormalizedBroadcastAnalyticsFilters): Promise<DashboardBuildResult> {
  const generatedAt = new Date().toISOString();
  const narrowUserId = filters.userId;

  let sessions = await fetchBroadcastSessionsForDashboard({
    userId: narrowUserId,
    filters,
    limit: BROADCAST_ANALYTICS_DASHBOARD_QUERY_OVERFETCH,
  });

  let facts = await buildFactsForSessions(sessions, { kind: "admin" });
  facts = applyCalendarLinkedFilter(facts, filters.calendarLinked);

  const truncatedBefore = facts.length > BROADCAST_ANALYTICS_DASHBOARD_MAX_SESSIONS;
  facts = facts.slice(0, BROADCAST_ANALYTICS_DASHBOARD_MAX_SESSIONS);

  return {
    summary: buildBroadcastAnalyticsDashboard(facts),
    breakdowns: buildBroadcastAnalyticsBreakdowns(facts),
    filtersApplied: filters,
    generatedAt,
    sessionsTruncated: truncatedBefore,
    sessionSampleSize: facts.length,
    recentSessions: facts.slice(0, 15).map((f) => ({
      sessionId: f.session.id,
      roomId: f.session.roomId,
      userId: f.session.userId,
      startedAt: f.session.startedAt ? new Date(f.session.startedAt).toISOString() : null,
      endedAt: f.session.endedAt ? new Date(f.session.endedAt).toISOString() : null,
      finalStatus: f.session.status,
      broadcastEventId: f.broadcastEventId,
      compositorMode: f.session.compositorMode ?? "v1_livekit_default",
    })),
  };
}
