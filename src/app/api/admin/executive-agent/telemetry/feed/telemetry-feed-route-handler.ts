/**
 * SKIPPER Phase 1 — STEP 1, Task 1.3: Gated Polling Event Feed (Option A).
 *
 * GET /api/admin/executive-agent/telemetry/feed — the telemetry
 * event feed the Desktop polls on the existing gated pattern
 * (behind explicit operator engagement or a relevant panel).
 * Returns the telemetry events (new_account, onboarding_completed,
 * asset_purchased) from platformActivity in chronological order,
 * with a cursor so the Desktop can poll incrementally.
 *
 * Admin-gated: the same NPC admin JWT (admin-token / auth-token
 * cookies, isAdmin: true) as the existing executive-agent reads.
 * No push sockets. No new database tables. No schema change.
 *
 * Delivery semantics (TiDB-compatible):
 * The feed orders by (createdAt, id) and paginates by that
 * cursor. Two TiDB facts shape this:
 * - TiDB does not support adding an AUTO_INCREMENT column via
 *   ALTER TABLE, and its AUTO_INCREMENT allocation is
 *   per-server (not globally monotonic) and does not reflect
 *   commit order, so a sequence column is not a safe delivery
 *   watermark here. (An earlier draft used a `seq` column;
 *   it was reverted for exactly these reasons.)
 * - createdAt is second-precision and id is a random UUID, so
 *   (createdAt, id) alone is not insertion-ordered: a later
 *   insert can share the cursor's timestamp yet sort below the
 *   cursor's id and be skipped, and inclusive timestamp
 *   filtering stalls within a large same-timestamp group.
 * The feed therefore applies a visibility watermark: it only
 * returns events with createdAt <= now - VISIBILITY_WINDOW.
 * New inserts have createdAt = now, which is after the
 * watermark, so no new event will ever be inserted with a
 * createdAt inside the range being polled. The set of events
 * at or below the watermark is closed, so (createdAt, id)
 * pagination inside it cannot skip a later insert and cannot
 * stall: the group is fully formed before the client pages
 * through it.
 *
 * The watermark alone cannot guarantee no skips: a transaction
 * that commits after the watermark has passed its createdAt
 * (i.e. a commit delay longer than the window) leaves its event
 * behind the cursor, and a bare forward cursor would never
 * return it. That case is handled by a client-driven catch-up,
 * not by re-scanning on every poll (a server-side re-scan on
 * every poll would re-deliver already-seen events and can stall
 * pagination when the re-scanned window exceeds the page limit).
 * A fixed rewind from the latest forward cursor is NOT
 * sufficient for catch-up: the forward cursor keeps advancing,
 * so by the time an hourly catch-up runs, the cursor may be far
 * more than the rewind window past a late event's createdAt, and
 * the rewind misses it — even for a commit delay of only 50
 * seconds. (An earlier draft recommended rewinding 5 minutes
 * from the latest forward cursor; that contract was corrected
 * because it misses exactly this case.)
 * The catch-up contract is: the client maintains its OWN
 * persisted catch-up checkpoint, separate from the forward
 * cursor, recording the timestamp up to which catch-up has been
 * completed. On a catch-up run, the client paginates COMPLETELY
 * (page by page, following nextCursor until an empty page) over
 * the interval from the catch-up checkpoint up to the current
 * watermark, deduping by event id. When the interval is drained
 * it persists the new checkpoint. Replay coverage therefore
 * spans the entire interval since the previous successful
 * catch-up — not merely a fixed window before the latest forward
 * cursor — so any event in that interval, including one delayed
 * only 50 seconds, is recovered regardless of how far the
 * forward cursor has advanced. Delivery is at-least-once with
 * dedup for events in the catch-up interval. An event whose
 * commit is delayed beyond the catch-up interval (it commits
 * after catch-up has already covered its createdAt) may be
 * missed by the feed; the revenue loop reconciles from the
 * source tables for critical reads rather than relying on the
 * feed for completeness. Catch-up scheduling (when to run it),
 * durable deduplication (persisting seen ids), and source
 * reconciliation are STEP 2 implementation requirements, not
 * part of this feed. The feed's part is only that it accepts
 * any cursor, including a catch-up checkpoint cursor, and
 * paginates from there.
 *
 * nextCursor is always a valid resume point: the last event's
 * (createdAt, id) on a non-empty page (even the final page),
 * and the incoming cursor re-encoded on an empty poll, so a
 * client never replays from the beginning by re-polling with
 * a null cursor.
 *
 * Replays: the feed may return an event the client has already
 * seen when the client re-polls from an earlier cursor (a
 * catch-up poll). The consumer must dedupe by event id. Use
 * dedupeTelemetryEventsById for that (see the spec).
 *
 * The handler is factored for testability (same pattern as
 * summary-route-handler): the route wires the real deps, and
 * the spec injects mocks. The spec also exercises the real
 * listTelemetryEventsFromDb against a real Drizzle DB backed by
 * a mock MySQL pool, so the production query (not just a mock
 * reader) is covered.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gt, inArray, lte, or } from "drizzle-orm";
import { platformActivity } from "@/lib/db/schema";
import { TELEMETRY_EVENT_TYPES } from "@/lib/telemetry/telemetry-events";
import type { getDb } from "@/lib/db";

export type TelemetryFeedDb = Awaited<ReturnType<typeof getDb>>;

export interface TelemetryFeedCursor {
  /** ISO timestamp of the last event seen. */
  c: string;
  /** Id of the last event seen (tiebreaker for equal timestamps). */
  i: string;
}

export interface TelemetryFeedEvent {
  id: string;
  eventType: string;
  sourceModule: string;
  payload: Record<string, unknown> | null;
  userId: number;
  trustId: string | null;
  createdAt: string;
}

export interface TelemetryFeedTools {
  listTelemetryEvents: (
    db: TelemetryFeedDb,
    cursor: TelemetryFeedCursor | null,
    limit: number,
  ) => Promise<{ events: TelemetryFeedEvent[]; nextCursor: string | null }>;
}

export interface TelemetryFeedDeps {
  getExecutiveAdminUserId: (req: NextRequest) => Promise<number | null>;
  getDb: () => Promise<TelemetryFeedDb>;
  tools: TelemetryFeedTools;
}

/** Default page size; the client may request 1..100. */
export const TELEMETRY_FEED_DEFAULT_LIMIT = 50;
export const TELEMETRY_FEED_MAX_LIMIT = 100;

/**
 * Visibility window: the feed only returns events whose
 * createdAt is at least this old, so the timestamp group being
 * polled is closed (no new insert will carry a createdAt in
 * that range) and its transaction has committed. 30 seconds is
 * far longer than any realistic single-row emit transaction.
 */
export const TELEMETRY_FEED_VISIBILITY_WINDOW_MS = 30_000;

export function parseTelemetryFeedLimit(raw: string | null): number {
  const n = raw == null ? NaN : Number(raw);
  if (!Number.isFinite(n)) return TELEMETRY_FEED_DEFAULT_LIMIT;
  return Math.min(
    TELEMETRY_FEED_MAX_LIMIT,
    Math.max(1, Math.floor(n)),
  );
}

/** Encode a cursor from the last event of a page. */
export function encodeTelemetryFeedCursor(event: {
  createdAt: string;
  id: string;
}): string {
  return Buffer.from(
    JSON.stringify({ c: event.createdAt, i: event.id }),
    "utf8",
  ).toString("base64url");
}

/**
 * Decode a cursor. Returns null when no cursor was supplied.
 * Throws when a supplied cursor is malformed (the handler
 * turns that into a 400).
 */
export function decodeTelemetryFeedCursor(
  raw: string | null,
): TelemetryFeedCursor | null {
  if (raw == null || raw === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid cursor");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid cursor");
  }
  const { c, i } = parsed as { c?: unknown; i?: unknown };
  if (typeof c !== "string" || typeof i !== "string") {
    throw new Error("Invalid cursor");
  }
  if (Number.isNaN(new Date(c).getTime())) {
    throw new Error("Invalid cursor");
  }
  return { c, i };
}

/**
 * Drop events the consumer has already acted on, by event id.
 * The feed returns each event exactly once per cursor chain, but
 * a client that re-polls from an earlier cursor (e.g. after
 * losing its position) may see an event again. The consumer
 * dedupes by id so a replay never causes a duplicate downstream
 * action. `seenIds` is the set of event ids already processed.
 */
export function dedupeTelemetryEventsById(
  events: TelemetryFeedEvent[],
  seenIds: ReadonlySet<string>,
): TelemetryFeedEvent[] {
  return events.filter((e) => !seenIds.has(e.id));
}

/**
 * The newest createdAt the feed will return. Events newer than
 * this are still within the visibility window (their timestamp
 * group is not yet closed / their transaction may not have
 * committed) and are held for a later poll. `now` is injected
 * so tests can control time.
 */
export function telemetryFeedWatermark(now: Date): Date {
  return new Date(now.getTime() - TELEMETRY_FEED_VISIBILITY_WINDOW_MS);
}

/**
 * Read one page of telemetry events from platformActivity.
 * Ordered chronologically (createdAt, then id). The cursor
 * selects strictly later events, so successive forward polls
 * return disjoint sets and the cursor always advances. Only
 * events at or below the visibility watermark are returned, so
 * the timestamp group being paged is closed and (createdAt, id)
 * pagination cannot skip a later insert or stall.
 *
 * A late-committing event (one whose transaction commits after
 * the watermark passed its createdAt) is behind the cursor and
 * is not returned by a forward poll. It is recovered by a
 * catch-up poll: the client re-polls from its own persisted
 * catch-up checkpoint (see the delivery semantics above) and
 * paginates completely over the interval since the previous
 * catch-up, deduping by id. The feed accepts any cursor,
 * including an earlier one.
 *
 * nextCursor is always a valid resume point:
 * - non-empty page: the last event's (createdAt, id), even on
 *   the final page (hasMore false), so the client resumes after
 *   the last event it received instead of restarting;
 * - empty page: the incoming cursor re-encoded, so the client
 *   keeps its position and the next poll resumes from the same
 *   point (no replay). When there was no incoming cursor and
 *   the feed is empty, nextCursor is null (nothing to resume).
 */
export async function listTelemetryEventsFromDb(
  db: TelemetryFeedDb,
  cursor: TelemetryFeedCursor | null,
  limit: number,
  now: Date = new Date(),
): Promise<{ events: TelemetryFeedEvent[]; nextCursor: string | null }> {
  const watermark = telemetryFeedWatermark(now);
  const eventTypeFilter = inArray(platformActivity.eventType, [
    ...TELEMETRY_EVENT_TYPES,
  ]);
  const visibleFilter = lte(platformActivity.createdAt, watermark);
  const where = cursor
    ? and(
        eventTypeFilter,
        visibleFilter,
        or(
          gt(platformActivity.createdAt, new Date(cursor.c)),
          and(
            eq(platformActivity.createdAt, new Date(cursor.c)),
            gt(platformActivity.id, cursor.i),
          ),
        ),
      )
    : and(eventTypeFilter, visibleFilter);

  const rows = await db
    .select()
    .from(platformActivity)
    .where(where)
    .orderBy(asc(platformActivity.createdAt), asc(platformActivity.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const events: TelemetryFeedEvent[] = page.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    sourceModule: row.sourceModule,
    payload: (row.payload ?? null) as Record<string, unknown> | null,
    userId: row.userId,
    trustId: row.trustId ?? null,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  }));
  let nextCursor: string | null;
  if (events.length > 0) {
    // Encode from the normalized event (createdAt is a string
    // here); the raw row's createdAt is a Date and is not
    // assignable to the cursor encoder's parameter type.
    nextCursor = encodeTelemetryFeedCursor(events[events.length - 1]);
  } else if (cursor != null) {
    // Empty poll: keep the caller's position so the next poll
    // resumes from the same point instead of restarting.
    nextCursor = encodeTelemetryFeedCursor({
      createdAt: cursor.c,
      id: cursor.i,
    });
  } else {
    nextCursor = null;
  }
  return { events, nextCursor };
}

/** GET /api/admin/executive-agent/telemetry/feed handler. */
export async function handleTelemetryFeedGet(
  req: NextRequest,
  deps: TelemetryFeedDeps,
): Promise<NextResponse> {
  const adminUserId = await deps.getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const limit = parseTelemetryFeedLimit(params.get("limit"));
  let cursor: TelemetryFeedCursor | null = null;
  try {
    cursor = decodeTelemetryFeedCursor(params.get("cursor"));
  } catch {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  }

  try {
    const db = await deps.getDb();
    const { events, nextCursor } = await deps.tools.listTelemetryEvents(
      db,
      cursor,
      limit,
    );
    return NextResponse.json({ ok: true, events, nextCursor });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Telemetry feed failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
