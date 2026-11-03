import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/mysql2";
import {
  decodeTelemetryFeedCursor,
  dedupeTelemetryEventsById,
  encodeTelemetryFeedCursor,
  handleTelemetryFeedGet,
  listTelemetryEventsFromDb,
  parseTelemetryFeedLimit,
  telemetryFeedWatermark,
  TELEMETRY_FEED_VISIBILITY_WINDOW_MS,
  type TelemetryFeedCursor,
  type TelemetryFeedDeps,
  type TelemetryFeedEvent,
} from "@/app/api/admin/executive-agent/telemetry/feed/telemetry-feed-route-handler";

// ---------------------------------------------------------------------------
// Real-Drizzle mock MySQL pool.
//
// The spec exercises the REAL listTelemetryEventsFromDb against a real
// Drizzle MySQL DB instance (drizzle-orm/mysql2) backed by this mock
// pool, so the production query — its WHERE, ordering, limit, and
// watermark/lookback — is covered with the actual dependencies, not
// a mock reader and not a stub condition builder. Drizzle calls
// pool.query({sql, rowsAsArray, typeCast}, params) and expects
// [rows, fields]; rows come back as ARRAYS in SELECT column order
// (rowsAsArray is true), and Drizzle maps them to objects.
//
// The mock filters the canned rows using the query's params, so the
// tests verify the query's filtering semantics (watermark,
// cursor, event types) and not just its pagination:
//   params[0..2] = the three telemetry event types
//   params[3]    = the watermark (MySQL datetime string)
//   params[4]    = the cursor timestamp, only when a cursor was
//                  supplied (8 params total): it appears twice,
//                  once for createdAt > ? and once for
//                  createdAt = ? (the id tiebreaker is params[6])
//   params[last] = the limit (limit + 1, as the handler requests)
// Rows also carry a `visibleAt` time: a row is only returned when
// visibleAt <= the mock's now, which simulates MVCC commit
// visibility (a row whose transaction has not committed yet is
// invisible). That is how out-of-order commit visibility and
// catch-up recovery are tested.
// ---------------------------------------------------------------------------

type MockRow = {
  id: string;
  eventType: string;
  sourceModule: string;
  payload: Record<string, unknown> | null;
  userId: number;
  trustId: string | null;
  createdAt: Date;
  /** When this row's transaction commits (becomes visible). */
  visibleAt: Date;
};

/** Parse a MySQL datetime string ("2026-11-01 17:30:00.000") as a UTC Date. */
function parseMysqlDatetime(s: string): Date {
  return new Date(`${s.replace(" ", "T")}Z`);
}

/** Format a Date as a MySQL datetime string (no timezone, seconds precision). */
function formatMysqlDatetime(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function cmpDate(a: Date, b: Date): number {
  return a.getTime() - b.getTime();
}

type MockPoolState = {
  rows: MockRow[];
  nowRef: { now: Date };
  /** Every SQL string + params the pool received, in order. */
  captured: { sql: string; params: unknown[] }[];
};

function makeMockPool(state: MockPoolState) {
  // SELECT column order for platformActivity (as Drizzle selects it):
  // id, userId, eventType, sourceModule, payload, trustId, createdAt
  const pool = {
    async query(sqlObj: { sql: string; rowsAsArray?: boolean }, params: unknown[]) {
      const sql = typeof sqlObj === "string" ? sqlObj : sqlObj.sql;
      state.captured.push({ sql, params: [...params] });
      // The feed query's params are positional (see the header
      // comment). The event-type list has exactly three entries
      // (TELEMETRY_EVENT_TYPES), so the watermark is params[3];
      // a lookback floor is present only when a cursor was
      // supplied (6 params), and the limit is always last.
      const eventTypes = (params.slice(0, 3) as string[]).filter(
        (p): p is string => typeof p === "string",
      );
      const watermark = parseMysqlDatetime(String(params[3]));
      const hasCursor = params.length === 8;
      const cursorC = hasCursor ? parseMysqlDatetime(String(params[4])) : null;
      const cursorI = hasCursor ? String(params[6]) : null;
      const limit = Number(params[params.length - 1]);

      let out = state.rows.filter((r) => {
        if (!eventTypes.includes(r.eventType)) return false;
        if (cmpDate(r.createdAt, watermark) > 0) return false;
        if (hasCursor && cursorC != null && cursorI != null) {
          const after =
            cmpDate(r.createdAt, cursorC) > 0 ||
            (cmpDate(r.createdAt, cursorC) === 0 && r.id > cursorI);
          if (!after) return false;
        }
        if (r.visibleAt.getTime() > state.nowRef.now.getTime()) return false;
        return true;
      });
      out = [...out].sort((a, b) => {
        const c = cmpDate(a.createdAt, b.createdAt);
        if (c !== 0) return c;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
      out = out.slice(0, limit);
      const arrays = out.map((r) => [
        r.id,
        r.userId,
        r.eventType,
        r.sourceModule,
        r.payload,
        r.trustId,
        formatMysqlDatetime(r.createdAt),
      ]);
      return [arrays, []];
    },
    async execute(sqlObj: unknown, params: unknown[]) {
      return pool.query(sqlObj as { sql: string }, params);
    },
    async getConnection() {
      return pool;
    },
    async end() {},
  };
  return pool;
}

/** Build a fake row. visibleAt defaults to createdAt (commits immediately). */
function fakeRow(
  id: string,
  createdAt: string,
  eventType = "new_account",
  visibleAt?: string,
): MockRow {
  return {
    id,
    eventType,
    sourceModule: "Marketplace",
    payload: { accountId: 1, isApproved: false, registeredAt: createdAt },
    userId: 1,
    trustId: null,
    createdAt: new Date(createdAt),
    visibleAt: new Date(visibleAt ?? createdAt),
  };
}

/** The fixed "now" for deterministic watermark tests. */
const NOW = new Date("2026-11-01T18:00:00.000Z");
/** createdAt values in these tests are all <= NOW - window, so they are visible. */
const T0 = "2026-11-01T17:00:00.000Z";
const T1 = "2026-11-01T17:01:00.000Z";
const T2 = "2026-11-01T17:02:00.000Z";

/**
 * Call the real listTelemetryEventsFromDb against a real Drizzle
 * DB backed by the mock pool. Returns the events/nextCursor plus
 * the captured SQL so tests can assert on the query itself.
 */
async function queryReal(
  rows: MockRow[],
  cursor: TelemetryFeedCursor | null,
  limit: number,
  now: Date = NOW,
): Promise<{
  events: TelemetryFeedEvent[];
  nextCursor: string | null;
  captured: { sql: string; params: unknown[] }[];
}> {
  const state: MockPoolState = { rows, nowRef: { now }, captured: [] };
  const pool = makeMockPool(state);
  const db = drizzle(pool as never);
  const { events, nextCursor } = await listTelemetryEventsFromDb(
    db as never,
    cursor,
    limit,
    now,
  );
  return { events, nextCursor, captured: state.captured };
}

// ---------------------------------------------------------------------------
// Handler tests (mocked tools) — these cover the HTTP handler, not the query.
// ---------------------------------------------------------------------------

const handlerEvents: TelemetryFeedEvent[] = [
  {
    id: "a",
    eventType: "new_account",
    sourceModule: "Marketplace",
    payload: { accountId: 1, isApproved: false, registeredAt: T0 },
    userId: 1,
    trustId: null,
    createdAt: T0,
  },
  {
    id: "b",
    eventType: "onboarding_completed",
    sourceModule: "Entity Builder",
    payload: { onboardingId: 7, onboardingStatus: "submitted" },
    userId: 1,
    trustId: null,
    createdAt: T1,
  },
  {
    id: "c",
    eventType: "asset_purchased",
    sourceModule: "Asset Marketplace",
    payload: { assetId: "asset-1", userId: 1, tokenPrice: 5 },
    userId: 1,
    trustId: null,
    createdAt: T2,
  },
];

/** Mock listTelemetryEvents that paginates the handler events like the real query. */
function mockListTelemetryEvents(
  _db: unknown,
  cursor: TelemetryFeedCursor | null,
  limit: number,
): Promise<{ events: TelemetryFeedEvent[]; nextCursor: string | null }> {
  const after = handlerEvents.filter((e) => {
    if (cursor == null) return true;
    if (e.createdAt > cursor.c) return true;
    if (e.createdAt === cursor.c && e.id > cursor.i) return true;
    return false;
  });
  const page = after.slice(0, limit);
  let nextCursor: string | null;
  if (page.length > 0) {
    nextCursor = encodeTelemetryFeedCursor(page[page.length - 1]);
  } else if (cursor != null) {
    nextCursor = encodeTelemetryFeedCursor({ createdAt: cursor.c, id: cursor.i });
  } else {
    nextCursor = null;
  }
  return Promise.resolve({ events: page, nextCursor });
}

function deps(overrides: Partial<TelemetryFeedDeps> = {}): TelemetryFeedDeps {
  return {
    getExecutiveAdminUserId: async () => 7,
    getDb: async () => ({}) as never,
    tools: { listTelemetryEvents: mockListTelemetryEvents as never },
    ...overrides,
  };
}

type FeedBody = {
  ok: boolean;
  events: TelemetryFeedEvent[];
  nextCursor: string | null;
};

async function getFeed(
  query: string,
  depOverrides: Partial<TelemetryFeedDeps> = {},
): Promise<{ status: number; body: FeedBody }> {
  const req = new NextRequest(
    `http://localhost/api/admin/executive-agent/telemetry/feed${query}`,
  );
  const res = await handleTelemetryFeedGet(req, deps(depOverrides));
  const body = (await res.json()) as FeedBody;
  return { status: res.status, body };
}

describe("telemetry feed cursor", () => {
  it("round-trips through encode and decode", () => {
    const cursor = encodeTelemetryFeedCursor({ createdAt: T1, id: "b" });
    assert.deepEqual(decodeTelemetryFeedCursor(cursor), { c: T1, i: "b" });
  });

  it("returns null for a missing cursor", () => {
    assert.equal(decodeTelemetryFeedCursor(null), null);
    assert.equal(decodeTelemetryFeedCursor(""), null);
  });

  it("throws for a malformed cursor", () => {
    assert.throws(() => decodeTelemetryFeedCursor("not-a-cursor"));
    assert.throws(() =>
      decodeTelemetryFeedCursor(Buffer.from("{}", "utf8").toString("base64url")),
    );
  });
});

describe("parseTelemetryFeedLimit", () => {
  it("defaults to 50 and clamps to 1..100", () => {
    assert.equal(parseTelemetryFeedLimit(null), 50);
    assert.equal(parseTelemetryFeedLimit("10"), 10);
    assert.equal(parseTelemetryFeedLimit("0"), 1);
    assert.equal(parseTelemetryFeedLimit("500"), 100);
    assert.equal(parseTelemetryFeedLimit("abc"), 50);
  });
});

describe("GET /api/admin/executive-agent/telemetry/feed handler", () => {
  it("returns 401 when admin auth fails", async () => {
    const req = new NextRequest(
      "http://localhost/api/admin/executive-agent/telemetry/feed",
    );
    const res = await handleTelemetryFeedGet(req, deps({
      getExecutiveAdminUserId: async () => null,
      getDb: async () => {
        throw new Error("db should not be called");
      },
    }));
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: "Unauthorized" });
  });

  it("returns 400 for a malformed cursor", async () => {
    const { status, body } = await getFeed("?cursor=not-a-cursor");
    assert.equal(status, 400);
    assert.deepEqual(body, { error: "Invalid cursor" });
  });

  it("returns events in order and paginates without duplicates", async () => {
    const { status: s1, body: b1 } = await getFeed("?limit=2");
    assert.equal(s1, 200);
    assert.equal(b1.ok, true);
    assert.deepEqual(
      b1.events.map((e) => e.id),
      ["a", "b"],
    );
    assert.equal(typeof b1.nextCursor, "string");

    const { status: s2, body: b2 } = await getFeed(
      `?limit=2&cursor=${encodeURIComponent(b1.nextCursor as string)}`,
    );
    assert.equal(s2, 200);
    assert.deepEqual(
      b2.events.map((e) => e.id),
      ["c"],
    );
    // The final page still returns a resume cursor (not null).
    assert.equal(typeof b2.nextCursor, "string");
  });

  it("returns no phone number in any event payload", async () => {
    const { status, body } = await getFeed("");
    assert.equal(status, 200);
    for (const event of body.events) {
      assert.equal(
        event.payload != null && "phone" in event.payload,
        false,
        `event ${event.id} payload must not carry a phone number`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Real-query tests: these call listTelemetryEventsFromDb against a real
// Drizzle DB backed by the mock MySQL pool, so they exercise the
// production query (WHERE, ordering, limit, watermark, lookback) with
// the actual dependencies. If the production SQL reader is replaced
// with a function that always throws, these tests fail.
// ---------------------------------------------------------------------------

describe("telemetry feed real query (listTelemetryEventsFromDb)", () => {
  it("resume cursors survive both the final page and empty polls", async () => {
    const rows = [
      fakeRow("a", T0, "new_account"),
      fakeRow("b", T1, "onboarding_completed"),
      fakeRow("c", T2, "asset_purchased"),
    ];
    // Page 1 of 2.
    const p1 = await queryReal(rows, null, 2);
    assert.deepEqual(
      p1.events.map((e) => e.id),
      ["a", "b"],
    );
    assert.equal(typeof p1.nextCursor, "string");

    // Final page: still returns a resume cursor, not null.
    const p2 = await queryReal(rows, decodeTelemetryFeedCursor(p1.nextCursor), 2);
    assert.deepEqual(
      p2.events.map((e) => e.id),
      ["c"],
    );
    assert.equal(
      typeof p2.nextCursor,
      "string",
      "the final page must return a resume cursor, not null",
    );
    const finalCursor = p2.nextCursor as string;
    assert.deepEqual(decodeTelemetryFeedCursor(finalCursor), { c: T2, i: "c" });

    // Empty poll with the final cursor: no events, and the
    // returned cursor is the same position (not null).
    const p3 = await queryReal(rows, decodeTelemetryFeedCursor(finalCursor), 2);
    assert.deepEqual(p3.events, []);
    assert.equal(p3.nextCursor, finalCursor);

    // A second empty poll is stable: same cursor, still empty.
    const p4 = await queryReal(rows, decodeTelemetryFeedCursor(p3.nextCursor), 2);
    assert.deepEqual(p4.events, []);
    assert.equal(p4.nextCursor, finalCursor);
  });

  it("later same-timestamp events with lower UUIDs are retrieved", async () => {
    // All events share one timestamp, which is older than the
    // watermark, so the group is closed: both events were
    // inserted before the watermark passed this timestamp, and
    // no further insert will carry it. The second-inserted event
    // has a LOWER id than the first. The feed pages the closed
    // group in (createdAt, id) order, so both are retrieved
    // (the lower-UUID event first). This is the case the bare
    // (createdAt, id) cursor used to skip; the watermark closes
    // the group first, so the cursor pages a complete group.
    const ts = T0;
    const rows: MockRow[] = [
      fakeRow("m-high", ts, "new_account"),
      fakeRow("a-low", ts, "new_account"),
    ];
    assert.equal(
      "a-low" < "m-high",
      true,
      "the later-inserted event's id sorts below the first event's id",
    );
    const { events } = await queryReal(rows, null, 50);
    assert.deepEqual(
      events.map((e) => e.id),
      ["a-low", "m-high"],
      "a later same-timestamp event with a lower UUID must be retrieved",
    );
  });

  it("timestamp groups larger than one page drain completely", async () => {
    // 150 events, all sharing one timestamp (older than the
    // watermark, so the group is closed), with ids that sort in
    // the OPPOSITE order to insertion. Limit 50.
    const ts = T0;
    const rows: MockRow[] = [];
    for (let n = 1; n <= 150; n += 1) {
      rows.push(fakeRow(`ev-${String(151 - n).padStart(3, "0")}`, ts, "new_account"));
    }

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    for (;;) {
      const { events, nextCursor } = await queryReal(
        rows,
        cursor == null ? null : decodeTelemetryFeedCursor(cursor),
        50,
      );
      pages += 1;
      for (const e of events) {
        if (!seen.includes(e.id)) seen.push(e.id);
      }
      if (events.length === 0) {
        assert.equal(nextCursor, cursor, "empty poll keeps the position");
        break;
      }
      assert.equal(typeof nextCursor, "string");
      assert.notEqual(
        nextCursor,
        cursor,
        "each page must advance the cursor (no stall)",
      );
      cursor = nextCursor;
      if (pages > 10) throw new Error("pagination stalled: too many pages");
    }

    assert.equal(pages, 4, "150 events at limit 50 drain in 3 pages + 1 empty");
    assert.equal(seen.length, 150, "all 150 events are returned");
    assert.equal(new Set(seen).size, 150, "no event is returned twice (after dedup)");
    // Drained in (createdAt, id) order, not insertion order.
    assert.equal(seen[0], "ev-001");
    assert.equal(seen[149], "ev-150");
  });

  it("the visibility watermark holds back events newer than the window", async () => {
    // An event newer than the watermark is not returned yet,
    // even though it exists and is visible (committed).
    const watermark = telemetryFeedWatermark(NOW);
    assert.equal(
      watermark.getTime(),
      NOW.getTime() - TELEMETRY_FEED_VISIBILITY_WINDOW_MS,
    );
    const freshTs = new Date(NOW.getTime() - 5_000).toISOString(); // 5s old, inside the window
    const oldTs = new Date(NOW.getTime() - 60_000).toISOString(); // 60s old, past the window
    const rows = [
      fakeRow("old", oldTs, "new_account"),
      fakeRow("fresh", freshTs, "new_account"),
    ];
    const { events } = await queryReal(rows, null, 50, NOW);
    assert.deepEqual(
      events.map((e) => e.id),
      ["old"],
      "only events at or below the watermark are returned",
    );
    // Once time advances past the window, the fresh event appears.
    const later = new Date(NOW.getTime() + 60_000);
    const { events: eventsLater } = await queryReal(rows, null, 50, later);
    assert.deepEqual(
      eventsLater.map((e) => e.id),
      ["old", "fresh"],
    );
  });

  it("out-of-order commit visibility: a late event is recovered by a checkpoint catch-up, not by a fixed rewind", async () => {
    // The reproduced miss: B is returned at 40s; older A commits
    // at 50s and is permanently behind B's cursor under a bare
    // forward poll. A fixed rewind from the latest forward cursor
    // does NOT recover it either: the forward cursor keeps
    // advancing, so by the time an hourly catch-up runs, the
    // cursor may be far more than the rewind window past A's
    // createdAt — even for a delay of only 50 seconds. The
    // correct contract is a persisted catch-up checkpoint: the
    // client paginates COMPLETELY over the interval since the
    // previous successful catch-up, so replay coverage spans
    // that whole interval, not merely a fixed window before the
    // latest forward cursor.
    const aCreated = "2026-11-01T17:00:00.000Z";
    const bCreated = "2026-11-01T17:00:10.000Z";
    const cCreated = "2026-11-01T17:10:00.000Z"; // 10 minutes later
    const aVisible = "2026-11-01T17:00:50.000Z"; // A commits 50s after creation
    const rows: MockRow[] = [
      fakeRow("a-late", aCreated, "new_account", aVisible),
      fakeRow("b-early", bCreated, "new_account", bCreated),
      fakeRow("c-later", cCreated, "new_account", cCreated),
    ];

    // Forward poll at 40s (now 17:00:40, watermark 17:00:10).
    // B is visible and at the watermark, so it is returned. A is
    // not visible yet (commits at 17:00:50). The cursor advances
    // to B. A is behind the cursor.
    const now1 = new Date("2026-11-01T17:00:40.000Z");
    const p1 = await queryReal(rows, null, 50, now1);
    assert.deepEqual(
      p1.events.map((e) => e.id),
      ["b-early"],
      "only the committed event is returned on the first poll",
    );
    const cursor1 = p1.nextCursor as string;
    assert.deepEqual(decodeTelemetryFeedCursor(cursor1), { c: bCreated, i: "b-early" });

    // Forward poll later (now 17:10:40, watermark 17:10:10).
    // C is returned; A is visible by now but is behind the
    // cursor, so a forward poll does not return it. The forward
    // cursor is now 10 minutes past A's createdAt.
    const now2 = new Date("2026-11-01T17:10:40.000Z");
    const p2 = await queryReal(rows, decodeTelemetryFeedCursor(cursor1), 50, now2);
    assert.deepEqual(
      p2.events.map((e) => e.id),
      ["c-later"],
      "the forward poll returns only the new event, not the late one",
    );
    const forwardCursor = p2.nextCursor as string;
    assert.deepEqual(decodeTelemetryFeedCursor(forwardCursor), { c: cCreated, i: "c-later" });

    // The flawed contract: rewind 5 minutes from the latest
    // forward cursor (17:10:00 -> floor 17:05:00) and poll.
    // A's createdAt (17:00:00) is before the floor, so the
    // rewind MISSES A — even though A was delayed only 50s.
    // (The client would pass a cursor at the floor; here it is
    // simulated directly.)
    const rewindFloor = new Date(
      new Date(cCreated).getTime() - 5 * 60 * 1000,
    ).toISOString();
    const rewind = await queryReal(
      rows,
      { c: rewindFloor, i: "" },
      50,
      now2,
    );
    assert.deepEqual(
      rewind.events.map((e) => e.id),
      ["c-later"],
      "a 5-minute rewind from the forward cursor misses the late event (its createdAt is before the floor)",
    );
    assert.equal(
      rewind.events.some((e) => e.id === "a-late"),
      false,
      "the rewind does not recover A",
    );

    // The correct contract: catch-up from the client's own
    // persisted checkpoint, paginating COMPLETELY over the
    // interval since the previous successful catch-up. Here the
    // previous checkpoint is the beginning (no prior catch-up),
    // and the catch-up paginates with limit 2, so it must drain
    // two pages to cover the whole interval [start, watermark].
    // Replay coverage spans the interval, so A is recovered even
    // though the forward cursor is 10 minutes past it.
    const seenCatchUp: string[] = [];
    let catchUpCursor: TelemetryFeedCursor | null = null;
    let catchUpPages = 0;
    for (;;) {
      const { events, nextCursor } = await queryReal(rows, catchUpCursor, 2, now2);
      catchUpPages += 1;
      for (const e of events) {
        if (!seenCatchUp.includes(e.id)) seenCatchUp.push(e.id);
      }
      if (events.length === 0) break;
      assert.equal(typeof nextCursor, "string");
      catchUpCursor = decodeTelemetryFeedCursor(nextCursor);
      if (catchUpPages > 10) throw new Error("catch-up pagination stalled");
    }
    assert.deepEqual(
      seenCatchUp,
      ["a-late", "b-early", "c-later"],
      "a complete catch-up from the persisted checkpoint covers the whole interval and recovers the late event",
    );
    assert.equal(catchUpPages, 3, "3 events at limit 2 drain in 2 pages + 1 empty");
    // The client dedupes against what the forward polls already
    // delivered (B and C); only A is new, so it acts once.
    const alreadySeen = new Set<string>(["b-early", "c-later"]);
    const fresh = seenCatchUp.filter((id) => !alreadySeen.has(id));
    assert.deepEqual(fresh, ["a-late"]);
  });

  it("the generated SQL carries the watermark, cursor, ordering, and limit", async () => {
    const rows = [fakeRow("a", T0, "new_account")];
    const { captured } = await queryReal(
      rows,
      { c: T1, i: "b" },
      10,
      NOW,
    );
    assert.equal(captured.length, 1, "exactly one query is issued");
    const { sql, params } = captured[0];
    assert.match(sql, /from `platform_activity`/);
    assert.match(sql, /`platform_activity`\.\`eventType\` in \(\?, \?, \?\)/);
    assert.match(sql, /`platform_activity`\.\`createdAt\` <= \?/);
    assert.match(
      sql,
      /`platform_activity`\.\`createdAt\` > \? or \(`platform_activity`\.\`createdAt\` = \? and `platform_activity`\.\`id\` > \?\)/,
      "the cursor selects strictly later events",
    );
    assert.match(sql, /order by `platform_activity`\.\`createdAt\` asc, `platform_activity`\.\`id\` asc/);
    assert.match(sql, /limit \?/);
    // Params: 3 event types, watermark, cursor timestamp (twice),
    // cursor id, limit (10 + 1).
    assert.deepEqual(params.slice(0, 3), [
      "new_account",
      "onboarding_completed",
      "asset_purchased",
    ]);
    assert.equal(
      parseMysqlDatetime(String(params[3])).getTime(),
      telemetryFeedWatermark(NOW).getTime(),
      "the watermark param is now minus the visibility window",
    );
    assert.equal(
      parseMysqlDatetime(String(params[4])).getTime(),
      new Date(T1).getTime(),
      "the cursor timestamp param is the cursor's createdAt",
    );
    assert.equal(String(params[6]), "b", "the cursor id param is the cursor's id");
    assert.equal(params[7], 11, "the limit param is limit + 1");
  });

  it("replayed events cause no duplicate downstream actions", async () => {
    // Simulate the consumer: it acts once per event id it has
    // not seen before. The feed returns [a, b]; the consumer
    // acts twice. Then a re-poll from an earlier cursor replays
    // [a, b] plus a new [c]. After dedup only [c] is new, so
    // the consumer acts exactly once more — total 3, not 5.
    const mk = (id: string): TelemetryFeedEvent => ({
      id,
      eventType: "new_account",
      sourceModule: "Marketplace",
      payload: { accountId: 1, isApproved: false, registeredAt: T0 },
      userId: 1,
      trustId: null,
      createdAt: T0,
    });
    const seenIds = new Set<string>();
    let actions = 0;
    const process = (events: TelemetryFeedEvent[]) => {
      for (const e of dedupeTelemetryEventsById(events, seenIds)) {
        seenIds.add(e.id);
        actions += 1;
      }
    };

    process([mk("a"), mk("b")]);
    assert.equal(actions, 2);

    // Replay of a and b, plus a genuinely new c.
    process([mk("a"), mk("b"), mk("c")]);
    assert.equal(actions, 3, "replayed events must not cause duplicate actions");
    assert.deepEqual([...seenIds].sort(), ["a", "b", "c"]);
  });
});
