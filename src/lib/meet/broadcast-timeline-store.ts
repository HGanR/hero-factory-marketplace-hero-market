import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetBroadcastSessions, meetBroadcastTimelineEvents } from "@/lib/db/schema";
import {
  BROADCAST_TIMELINE_EVENT_TYPES,
  buildBroadcastTimelineEvent,
  validateBroadcastTimelineEvent,
  type BroadcastTimelineAppendInput,
  type BroadcastTimelineEvent,
  type BroadcastTimelineEventType,
} from "./broadcast-timeline";

const IN_CHUNK = 250;

export type BroadcastTimelineSummary = {
  totalEvents: number;
  countsByType: Partial<Record<BroadcastTimelineEventType, number>>;
  firstEventAtIso: string | null;
  lastEventAtIso: string | null;
};

function parseEventType(raw: string): BroadcastTimelineEventType {
  return (BROADCAST_TIMELINE_EVENT_TYPES as readonly string[]).includes(raw)
    ? (raw as BroadcastTimelineEventType)
    : "note";
}

function rowToEvent(row: typeof meetBroadcastTimelineEvents.$inferSelect): BroadcastTimelineEvent {
  let detailsJson: Record<string, unknown> | null = null;
  if (row.detailsJson != null && typeof row.detailsJson === "object" && !Array.isArray(row.detailsJson)) {
    detailsJson = row.detailsJson as Record<string, unknown>;
  }
  const at = row.eventAt instanceof Date ? row.eventAt : new Date(row.eventAt);
  return {
    id: row.id,
    broadcastSessionId: row.broadcastSessionId,
    userId: row.userId,
    eventType: parseEventType(row.eventType),
    eventAtIso: at.toISOString(),
    summary: row.summary,
    detailsJson,
  };
}

export async function assertTimelineSessionOwned(
  broadcastSessionId: number,
  userId: number
): Promise<{ ok: true } | { ok: false; code: "not_found" | "forbidden" }> {
  const db = await getDb();
  const rows = await db
    .select({ id: meetBroadcastSessions.id, userId: meetBroadcastSessions.userId })
    .from(meetBroadcastSessions)
    .where(eq(meetBroadcastSessions.id, broadcastSessionId))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false, code: "not_found" };
  if (row.userId !== userId) return { ok: false, code: "forbidden" };
  return { ok: true };
}

export async function listBroadcastTimelineEvents(
  broadcastSessionId: number,
  opts?: { limit?: number }
): Promise<BroadcastTimelineEvent[]> {
  const db = await getDb();
  const lim =
    opts?.limit != null && Number.isFinite(opts.limit) && opts.limit > 0
      ? Math.min(Math.floor(opts.limit), 10_000)
      : 10_000;
  const rows = await db
    .select()
    .from(meetBroadcastTimelineEvents)
    .where(eq(meetBroadcastTimelineEvents.broadcastSessionId, broadcastSessionId))
    .orderBy(desc(meetBroadcastTimelineEvents.eventAt))
    .limit(lim);
  return rows.map(rowToEvent);
}

export async function buildBroadcastTimelineSummary(broadcastSessionId: number): Promise<BroadcastTimelineSummary> {
  const db = await getDb();
  const [agg] = await db
    .select({
      totalEvents: sql<number>`count(${meetBroadcastTimelineEvents.id})`.mapWith(Number),
      firstEventAt: sql<Date | null>`min(${meetBroadcastTimelineEvents.eventAt})`,
      lastEventAt: sql<Date | null>`max(${meetBroadcastTimelineEvents.eventAt})`,
    })
    .from(meetBroadcastTimelineEvents)
    .where(eq(meetBroadcastTimelineEvents.broadcastSessionId, broadcastSessionId));

  const countRows = await db
    .select({
      eventType: meetBroadcastTimelineEvents.eventType,
      cnt: sql<number>`count(${meetBroadcastTimelineEvents.id})`.mapWith(Number),
    })
    .from(meetBroadcastTimelineEvents)
    .where(eq(meetBroadcastTimelineEvents.broadcastSessionId, broadcastSessionId))
    .groupBy(meetBroadcastTimelineEvents.eventType);

  const countsByType: Partial<Record<BroadcastTimelineEventType, number>> = {};
  for (const r of countRows) {
    if (!(BROADCAST_TIMELINE_EVENT_TYPES as readonly string[]).includes(r.eventType)) continue;
    const t = r.eventType as BroadcastTimelineEventType;
    countsByType[t] = r.cnt;
  }

  const total = agg?.totalEvents ?? 0;
  const first = agg?.firstEventAt ? new Date(agg.firstEventAt).toISOString() : null;
  const last = agg?.lastEventAt ? new Date(agg.lastEventAt).toISOString() : null;

  return {
    totalEvents: total,
    countsByType,
    firstEventAtIso: first,
    lastEventAtIso: last,
  };
}

export async function getBroadcastTimelinePreviewForSession(broadcastSessionId: number): Promise<{
  eventCount: number;
  latestEvent: { summary: string; eventType: string; eventAtIso: string } | null;
}> {
  const db = await getDb();
  const [cntRow] = await db
    .select({ c: sql<number>`count(${meetBroadcastTimelineEvents.id})`.mapWith(Number) })
    .from(meetBroadcastTimelineEvents)
    .where(eq(meetBroadcastTimelineEvents.broadcastSessionId, broadcastSessionId));
  const eventCount = cntRow?.c ?? 0;
  if (eventCount === 0) {
    return { eventCount: 0, latestEvent: null };
  }
  const [latest] = await db
    .select()
    .from(meetBroadcastTimelineEvents)
    .where(eq(meetBroadcastTimelineEvents.broadcastSessionId, broadcastSessionId))
    .orderBy(desc(meetBroadcastTimelineEvents.eventAt))
    .limit(1);
  if (!latest) return { eventCount: 0, latestEvent: null };
  const ev = rowToEvent(latest);
  return {
    eventCount,
    latestEvent: {
      summary: ev.summary,
      eventType: ev.eventType,
      eventAtIso: ev.eventAtIso,
    },
  };
}

export async function getTimelineTypeCountsForSessions(
  sessionIds: number[]
): Promise<Map<number, Partial<Record<BroadcastTimelineEventType, number>>>> {
  const out = new Map<number, Partial<Record<BroadcastTimelineEventType, number>>>();
  const unique = [...new Set(sessionIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (!unique.length) return out;
  const db = await getDb();
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const part = unique.slice(i, i + IN_CHUNK);
    const rows = await db
      .select({
        broadcastSessionId: meetBroadcastTimelineEvents.broadcastSessionId,
        eventType: meetBroadcastTimelineEvents.eventType,
        cnt: sql<number>`count(${meetBroadcastTimelineEvents.id})`.mapWith(Number),
      })
      .from(meetBroadcastTimelineEvents)
      .where(inArray(meetBroadcastTimelineEvents.broadcastSessionId, part))
      .groupBy(meetBroadcastTimelineEvents.broadcastSessionId, meetBroadcastTimelineEvents.eventType);
    for (const r of rows) {
      if (!(BROADCAST_TIMELINE_EVENT_TYPES as readonly string[]).includes(r.eventType)) continue;
      const t = r.eventType as BroadcastTimelineEventType;
      let m = out.get(r.broadcastSessionId);
      if (!m) {
        m = {};
        out.set(r.broadcastSessionId, m);
      }
      m[t] = (m[t] ?? 0) + r.cnt;
    }
  }
  return out;
}

export async function appendBroadcastTimelineEvent(
  input: BroadcastTimelineAppendInput
): Promise<{ ok: true; id: number } | { ok: false; errors: string[] }> {
  const v = validateBroadcastTimelineEvent({
    eventType: input.eventType,
    summary: input.summary,
    detailsJson: input.detailsJson ?? null,
    eventAtIso: input.eventAtIso,
  });
  if (!v.ok) return v;
  const b = buildBroadcastTimelineEvent(input);
  const db = await getDb();
  try {
    const inserted = await db
      .insert(meetBroadcastTimelineEvents)
      .values({
        broadcastSessionId: b.broadcastSessionId,
        userId: b.userId,
        eventType: b.eventType,
        summary: b.summary,
        detailsJson: b.detailsJson,
        eventAt: new Date(b.eventAtIso),
      })
      .$returningId();
    const id = inserted[0]?.id;
    if (id == null) return { ok: false, errors: ["insert_failed"] };
    return { ok: true, id: Number(id) };
  } catch {
    return { ok: false, errors: ["persist_failed"] };
  }
}
