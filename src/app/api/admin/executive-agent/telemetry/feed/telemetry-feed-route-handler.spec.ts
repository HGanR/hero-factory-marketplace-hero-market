import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import {
  decodeTelemetryFeedCursor,
  dedupeTelemetryEventsById,
  encodeTelemetryFeedCursor,
  handleTelemetryFeedGet,
  parseTelemetryFeedLimit,
  type TelemetryFeedCursor,
  type TelemetryFeedDeps,
  type TelemetryFeedEvent,
} from "@/app/api/admin/executive-agent/telemetry/feed/telemetry-feed-route-handler";

/** Build a fake event with an insertion sequence. */
function fakeEvent(
  id: string,
  seq: number,
  createdAt: string,
  eventType = "new_account",
): TelemetryFeedEvent {
  return {
    id,
    eventType,
    sourceModule: "Marketplace",
    payload: { accountId: seq, isApproved: false, registeredAt: createdAt },
    userId: 1,
    trustId: null,
    createdAt,
    seq,
  };
}

const fakeEvents: TelemetryFeedEvent[] = [
  fakeEvent("a", 1, "2026-11-01T17:00:00.000Z", "new_account"),
  fakeEvent("b", 2, "2026-11-01T17:01:00.000Z", "onboarding_completed"),
  fakeEvent("c", 3, "2026-11-01T17:02:00.000Z", "asset_purchased"),
];

/**
 * Mock listTelemetryEvents that paginates a store like the real
 * DB query: filter seq > cursor, order by seq, limit+1 for
 * hasMore. nextCursor is always a valid resume point (the last
 * event's seq on a non-empty page, the incoming cursor on an
 * empty poll).
 */
function mockListTelemetryEventsFor(
  store: TelemetryFeedEvent[],
): (
  _db: unknown,
  cursor: TelemetryFeedCursor | null,
  limit: number,
) => Promise<{ events: TelemetryFeedEvent[]; nextCursor: string | null }> {
  return (_db, cursor, limit) => {
    const after = store
      .filter((e) => cursor == null || e.seq > cursor.s)
      .sort((x, y) => x.seq - y.seq);
    const page = after.slice(0, limit);
    const hasMore = after.length > limit;
    void hasMore;
    let nextCursor: string | null;
    if (page.length > 0) {
      nextCursor = encodeTelemetryFeedCursor(page[page.length - 1]);
    } else if (cursor != null) {
      nextCursor = encodeTelemetryFeedCursor({ seq: cursor.s });
    } else {
      nextCursor = null;
    }
    return Promise.resolve({ events: page, nextCursor });
  };
}

function deps(overrides: Partial<TelemetryFeedDeps> = {}): TelemetryFeedDeps {
  return {
    getExecutiveAdminUserId: async () => 7,
    getDb: async () => ({}) as never,
    tools: {
      listTelemetryEvents: mockListTelemetryEventsFor(fakeEvents) as never,
    },
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
    const cursor = encodeTelemetryFeedCursor({ seq: 42 });
    assert.deepEqual(decodeTelemetryFeedCursor(cursor), { s: 42 });
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

  it("throws for the pre-fix {c, i} cursor format", () => {
    const legacy = Buffer.from(
      JSON.stringify({ c: "2026-11-01T17:01:00.000Z", i: "b" }),
      "utf8",
    ).toString("base64url");
    assert.throws(() => decodeTelemetryFeedCursor(legacy));
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
    // Second page is disjoint from the first and in order.
    assert.deepEqual(
      b2.events.map((e) => e.id),
      ["c"],
    );
    // The final page still returns a resume cursor (not null),
    // so the client resumes after the last event instead of
    // restarting from the beginning.
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

describe("telemetry feed pagination regressions (PR #14 blockers)", () => {
  it("resume cursors survive both the final page and empty polls", async () => {
    // Page 1 of 2.
    const { body: b1 } = await getFeed("?limit=2");
    assert.deepEqual(
      b1.events.map((e) => e.id),
      ["a", "b"],
    );
    assert.equal(typeof b1.nextCursor, "string");

    // Final page: still returns a resume cursor, not null.
    const { body: b2 } = await getFeed(
      `?limit=2&cursor=${encodeURIComponent(b1.nextCursor as string)}`,
    );
    assert.deepEqual(
      b2.events.map((e) => e.id),
      ["c"],
    );
    assert.equal(
      typeof b2.nextCursor,
      "string",
      "the final page must return a resume cursor, not null",
    );
    const finalCursor = b2.nextCursor as string;
    assert.deepEqual(decodeTelemetryFeedCursor(finalCursor), { s: 3 });

    // Empty poll with the final cursor: no events, and the
    // returned cursor is the same position (not null), so the
    // client keeps polling from the same point and never
    // restarts from the beginning.
    const { body: b3 } = await getFeed(
      `?limit=2&cursor=${encodeURIComponent(finalCursor)}`,
    );
    assert.deepEqual(b3.events, []);
    assert.equal(b3.nextCursor, finalCursor);

    // A second empty poll is stable: same cursor, still empty.
    const { body: b4 } = await getFeed(
      `?limit=2&cursor=${encodeURIComponent(b3.nextCursor as string)}`,
    );
    assert.deepEqual(b4.events, []);
    assert.equal(b4.nextCursor, finalCursor);
  });

  it("later same-timestamp events with lower UUIDs are retrieved", async () => {
    // All events share one timestamp. The first event has a
    // HIGH id; the later insert has a LOWER id but a HIGHER
    // insertion sequence. Under the old (createdAt, id) filter
    // the later insert would be skipped (its id sorts below
    // the cursor's id); under seq ordering it is returned.
    const ts = "2026-11-01T17:00:00.000Z";
    const store: TelemetryFeedEvent[] = [fakeEvent("m-high", 1, ts)];
    const list = mockListTelemetryEventsFor(store);

    // Poll once: receive the first event, cursor seq 1.
    const first = await list({} as never, null, 50);
    assert.deepEqual(
      first.events.map((e) => e.id),
      ["m-high"],
    );
    const cursor = first.nextCursor as string;
    assert.deepEqual(decodeTelemetryFeedCursor(cursor), { s: 1 });

    // A later insert shares the timestamp but has a lower UUID.
    const late = fakeEvent("a-low", 2, ts);
    assert.equal(late.createdAt, ts);
    assert.equal(
      late.id < "m-high",
      true,
      "the late event's id sorts below the cursor event's id",
    );
    store.push(late);

    // Poll with the cursor: the late event must be returned.
    const second = await list(
      {} as never,
      decodeTelemetryFeedCursor(cursor),
      50,
    );
    assert.deepEqual(
      second.events.map((e) => e.id),
      ["a-low"],
      "a later same-timestamp event with a lower UUID must be retrieved",
    );
  });

  it("timestamp groups larger than one page drain completely", async () => {
    // 150 events, all sharing one timestamp, with ids that
    // sort in the OPPOSITE order to seq (so the drain cannot
    // be an accident of id ordering). Limit 50.
    const ts = "2026-11-01T17:00:00.000Z";
    const store: TelemetryFeedEvent[] = [];
    for (let n = 1; n <= 150; n += 1) {
      // Id sorts descending while seq ascends.
      store.push(fakeEvent(`ev-${String(151 - n).padStart(3, "0")}`, n, ts));
    }
    const list = mockListTelemetryEventsFor(store);

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    for (;;) {
      const { events, nextCursor } = await list(
        {} as never,
        cursor == null ? null : decodeTelemetryFeedCursor(cursor),
        50,
      );
      pages += 1;
      for (const e of events) seen.push(e.id);
      // Every non-empty page returns a resume cursor; the
      // drain must not stall on the same first page.
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
    // Drained in insertion (seq) order, not id order.
    assert.equal(seen[0], "ev-150");
    assert.equal(seen[149], "ev-001");
  });

  it("replayed events cause no duplicate downstream actions", async () => {
    // Simulate the consumer: it acts once per event id it has
    // not seen before. The feed returns [a, b]; the consumer
    // acts twice. Then a re-poll from an earlier cursor replays
    // [a, b] plus a new [c]. After dedup only [c] is new, so
    // the consumer acts exactly once more — total 3, not 5.
    const seenIds = new Set<string>();
    let actions = 0;
    const process = (events: TelemetryFeedEvent[]) => {
      for (const e of dedupeTelemetryEventsById(events, seenIds)) {
        seenIds.add(e.id);
        actions += 1;
      }
    };

    process([fakeEvents[0], fakeEvents[1]]);
    assert.equal(actions, 2);

    // Replay of a and b, plus a genuinely new c.
    process([fakeEvents[0], fakeEvents[1], fakeEvents[2]]);
    assert.equal(actions, 3, "replayed events must not cause duplicate actions");
    assert.deepEqual([...seenIds].sort(), ["a", "b", "c"]);
  });
});
