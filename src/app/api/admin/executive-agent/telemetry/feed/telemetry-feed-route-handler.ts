/**
 * SKIPPER Phase 1 — STEP 1, Task 1.3: Gated Polling Event Feed (Option A).
 *
 * GET /api/admin/executive-agent/telemetry/feed — the telemetry
 * event feed the Desktop polls on the existing gated pattern
 * (behind explicit operator engagement or a relevant panel).
 * Returns the telemetry events (new_account, onboarding_completed,
 * asset_purchased) from platformActivity in insertion order,
 * with a cursor so the Desktop can poll incrementally.
 *
 * Admin-gated: the same NPC admin JWT (admin-token / auth-token
 * cookies, isAdmin: true) as the existing executive-agent reads.
 * No push sockets.
 *
 * Pagination — why a monotonic sequence, not (createdAt, id):
 * platformActivity's createdAt is second-precision and its id is
 * a random UUID, so (createdAt, id) is NOT insertion-ordered.
 * A later insert can share the cursor's timestamp yet sort below
 * the cursor's id, and the (createdAt = c AND id > i) filter then
 * skips it forever. Inclusive timestamp filtering (createdAt >= c)
 * with client-side dedup does not fix it either: within one
 * timestamp group larger than a page it returns the same first
 * page repeatedly and pagination stalls. So the feed orders by
 * the monotonic insertion sequence `seq` (added by migration
 * 0136_platform_activity_seq; see the PR description). The cursor
 * is the last event's seq, the filter is seq > cursor, and the
 * nextCursor is always a valid resume point — the last event's
 * seq on a non-empty page (even the final page), and the incoming
 * cursor on an empty poll — so a client never replays from the
 * beginning by re-polling with a null cursor.
 *
 * Replays: the feed returns each event exactly once for a given
 * cursor chain (seq > is strict). If a client re-polls from an
 * earlier cursor (e.g. after losing its position) it may see an
 * event again; the consumer must dedupe by event id. Use
 * dedupeTelemetryEventsById for that (see test 4 in the spec).
 *
 * The handler is factored for testability (same pattern as
 * summary-route-handler): the route wires the real deps, and
 * the spec injects mocks.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, asc, gt, inArray } from "drizzle-orm";
import { platformActivity } from "@/lib/db/schema";
import { TELEMETRY_EVENT_TYPES } from "@/lib/telemetry/telemetry-events";
import type { getDb } from "@/lib/db";

export type TelemetryFeedDb = Awaited<ReturnType<typeof getDb>>;

/**
 * Cursor: the monotonic insertion sequence of the last event seen.
 * A single number, because `seq` is a total order by insertion.
 * (The pre-fix cursor was {c: createdAt, i: id}; that format is
 * rejected as invalid now that the feed orders by seq.)
 */
export interface TelemetryFeedCursor {
  /** Insertion sequence of the last event seen. */
  s: number;
}

export interface TelemetryFeedEvent {
  id: string;
  eventType: string;
  sourceModule: string;
  payload: Record<string, unknown> | null;
  userId: number;
  trustId: string | null;
  createdAt: string;
  /** Monotonic insertion sequence (the pagination order). */
  seq: number;
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

export function parseTelemetryFeedLimit(raw: string | null): number {
  const n = raw == null ? NaN : Number(raw);
  if (!Number.isFinite(n)) return TELEMETRY_FEED_DEFAULT_LIMIT;
  return Math.min(
    TELEMETRY_FEED_MAX_LIMIT,
    Math.max(1, Math.floor(n)),
  );
}

/** Encode a cursor from the last event of a page. */
export function encodeTelemetryFeedCursor(event: { seq: number }): string {
  return Buffer.from(
    JSON.stringify({ s: event.seq }),
    "utf8",
  ).toString("base64url");
}

/**
 * Decode a cursor. Returns null when no cursor was supplied.
 * Throws when a supplied cursor is malformed (the handler
 * turns that into a 400). The pre-fix {c, i} format is
 * rejected: it cannot be mapped to a seq, so a client holding
 * one must re-poll from the beginning.
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
  const { s } = parsed as { s?: unknown };
  if (typeof s !== "number" || !Number.isInteger(s) || s < 0) {
    throw new Error("Invalid cursor");
  }
  return { s };
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
 * Read one page of telemetry events from platformActivity.
 * Ordered by insertion sequence (seq). The cursor selects
 * strictly later events (seq > cursor), so successive polls
 * return disjoint sets and no event is skipped: a later insert
 * always gets a higher seq, whatever its timestamp or UUID.
 *
 * nextCursor is always a valid resume point:
 * - non-empty page: the last event's seq (even on the final
 *   page, when hasMore is false), so the client resumes after
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
): Promise<{ events: TelemetryFeedEvent[]; nextCursor: string | null }> {
  const eventTypeFilter = inArray(platformActivity.eventType, [
    ...TELEMETRY_EVENT_TYPES,
  ]);
  const where = cursor
    ? and(eventTypeFilter, gt(platformActivity.seq, cursor.s))
    : eventTypeFilter;

  const rows = await db
    .select()
    .from(platformActivity)
    .where(where)
    .orderBy(asc(platformActivity.seq))
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
    seq: row.seq,
  }));
  let nextCursor: string | null;
  if (page.length > 0) {
    nextCursor = encodeTelemetryFeedCursor(page[page.length - 1]);
  } else if (cursor != null) {
    // Empty poll: keep the caller's position so the next poll
    // resumes from the same point instead of restarting.
    nextCursor = encodeTelemetryFeedCursor({ seq: cursor.s });
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
