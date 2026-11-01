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
 * No push sockets. No new database tables.
 *
 * The handler is factored for testability (same pattern as
 * summary-route-handler): the route wires the real deps, and
 * the spec injects mocks.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gt, inArray, or } from "drizzle-orm";
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
 * Read one page of telemetry events from platformActivity.
 * Ordered chronologically (createdAt, then id). The cursor
 * selects strictly later events, so successive polls return
 * disjoint sets.
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
    ? and(
        eventTypeFilter,
        or(
          gt(platformActivity.createdAt, new Date(cursor.c)),
          and(
            eq(platformActivity.createdAt, new Date(cursor.c)),
            gt(platformActivity.id, cursor.i),
          ),
        ),
      )
    : eventTypeFilter;

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
  const nextCursor =
    hasMore && page.length > 0
      ? encodeTelemetryFeedCursor(page[page.length - 1])
      : null;
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
