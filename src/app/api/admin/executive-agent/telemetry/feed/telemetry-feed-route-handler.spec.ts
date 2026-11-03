import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
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
// Mock DB that interprets the Drizzle query the production code builds.
// This is what lets the spec exercise the REAL listTelemetryEventsFromDb
// (the actual query, not a mock reader): the mock implements the
// select/from/where/orderBy/limit chain and evaluates the WHERE
// condition (and/or/gt/lte/eq/inArray) against its rows, so a wrong
// WHERE clause, a wrong ordering, or a wrong limit shows up here.
// Rows also carry a `visibleAt` time: a row is only returned when
// visibleAt <= the mock's now, which simulates MVCC commit
// visibility (a row whose transaction has not committed yet is
// invisible). That is how out-of-order commit visibility is tested.
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

type Condition =
  | { op: "and"; args: Condition[] }
  | { op: "or"; args: Condition[] }
  | { op: "gt"; col: string; val: unknown }
  | { op: "lte"; col: string; val: unknown }
  | { op: "eq"; col: string; val: unknown }
  | { op: "in"; col: string; vals: unknown[] };

function colVal(row: MockRow, col: string): unknown {
  return (row as unknown as Record<string, unknown>)[col];
}

function cmp(a: unknown, b: unknown): number {
  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  const as = String(av);
  const bs = String(bv);
  return as < bs ? -1 : as > bs ? 1 : 0;
}

function evalCondition(cond: Condition, row: MockRow): boolean {
  switch (cond.op) {
    case "and":
      return cond.args.every((c) => evalCondition(c, row));
    case "or":
      return cond.args.some((c) => evalCondition(c, row));
    case "gt":
      return cmp(colVal(row, cond.col), cond.val) > 0;
    case "lte":
      return cmp(colVal(row, cond.col), cond.val) <= 0;
    case "eq":
      return cmp(colVal(row, cond.col), cond.val) === 0;
    case "in":
      return cond.vals.some((v) => cmp(colVal(row, cond.col), v) === 0);
    default:
      throw new Error(`unknown condition op ${(cond as { op: string }).op}`);
  }
}

function makeMockDb(rows: MockRow[], nowRef: { now: Date }) {
  return {
    select() {
      const state: {
        where: Condition | null;
        orders: { op: string; col: string }[];
        limit: number | null;
      } = { where: null, orders: [], limit: null };
      const builder = {
        from(_table: unknown) {
          return builder;
        },
        where(cond: Condition) {
          state.where = cond;
          return builder;
        },
        orderBy(...orders: { op: string; col: string }[]) {
          state.orders = orders;
          return builder;
        },
        limit(n: number) {
          state.limit = n;
          // Execute: visible rows only, then WHERE, then order, then limit.
          let out = rows.filter((r) => r.visibleAt.getTime() <= nowRef.now.getTime());
          if (state.where) out = out.filter((r) => evalCondition(state.where as Condition, r));
          out = [...out].sort((a, b) => {
            for (const o of state.orders) {
              const c = cmp(colVal(a, o.col), colVal(b, o.col));
              if (c !== 0) return c;
            }
            return 0;
          });
          if (state.limit != null) out = out.slice(0, state.limit);
          return Promise.resolve(out);
        },
      };
      return builder;
    },
  };
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

/** Call the real listTelemetryEventsFromDb against the mock DB. */
async function queryReal(
  rows: MockRow[],
  cursor: TelemetryFeedCursor | null,
  limit: number,
  now: Date = NOW,
): Promise<{ events: TelemetryFeedEvent[]; nextCursor: string | null }> {
  const nowRef = { now };
  const db = makeMockDb(rows, nowRef);
  return listTelemetryEventsFromDb(db as never, cursor, limit, now);
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
  const hasMore = after.length > limit;
  let nextCursor: string | null;
  if (page.length > 0) {
    nextCursor = encodeTelemetryFeedCursor(page[page.length - 1]);
  } else if (cursor != null) {
    nextCursor = encodeTelemetryFeedCursor({ createdAt: cursor.c, id: cursor.i });
  } else {
    nextCursor = null;
  }
  void hasMore;
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
// Real-query tests: these call listTelemetryEventsFromDb against the
// mock DB, so they exercise the production query (WHERE, ordering,
// limit, watermark, nextCursor) — not a mock reader. If the
// production SQL reader is replaced with a function that always
// throws, these tests fail.
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
      for (const e of events) seen.push(e.id);
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
    assert.equal(new Set(seen).size, 150, "no event is returned twice");
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

  it("out-of-order commit visibility: a late-committing event is not skipped", async () => {
    // Event B is created later (higher createdAt) but commits
    // first; event A is created earlier (lower createdAt) but
    // its transaction commits late, after B is already visible.
    // Without a watermark, a poll that returned B first would
    // advance the cursor past A and skip it. With the watermark,
    // the feed holds both back until the window has passed, so
    // the client only polls once both have committed, and sees
    // them in (createdAt, id) order with neither skipped.
    const aCreated = "2026-11-01T17:00:00.000Z";
    const bCreated = "2026-11-01T17:00:10.000Z";
    const aVisible = "2026-11-01T17:00:20.000Z"; // A commits 20s after creation (within the 30s window)
    const bVisible = "2026-11-01T17:00:10.000Z"; // B commits immediately
    const rows: MockRow[] = [
      fakeRow("a-late", aCreated, "new_account", aVisible),
      fakeRow("b-early", bCreated, "new_account", bVisible),
    ];

    // Poll early, while B is visible but the watermark has not
    // yet passed either event. Both are held back (too new),
    // so the cursor does not advance past A.
    const early = new Date("2026-11-01T17:00:15.000Z");
    const pEarly = await queryReal(rows, null, 50, early);
    assert.deepEqual(
      pEarly.events,
      [],
      "the watermark holds back events newer than the window, even if visible",
    );
    assert.equal(pEarly.nextCursor, null, "nothing to resume from yet");

    // Poll after the watermark has passed both events and both
    // have committed. Both are returned in (createdAt, id)
    // order, even though B became visible first.
    const later = new Date("2026-11-01T17:00:45.000Z");
    const pLater = await queryReal(rows, null, 50, later);
    assert.deepEqual(
      pLater.events.map((e) => e.id),
      ["a-late", "b-early"],
      "once the watermark passes, both events are returned in order (no skip)",
    );
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
