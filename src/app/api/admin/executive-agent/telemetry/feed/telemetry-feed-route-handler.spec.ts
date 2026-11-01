import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import {
  decodeTelemetryFeedCursor,
  encodeTelemetryFeedCursor,
  handleTelemetryFeedGet,
  parseTelemetryFeedLimit,
  type TelemetryFeedCursor,
  type TelemetryFeedDeps,
  type TelemetryFeedEvent,
} from "@/app/api/admin/executive-agent/telemetry/feed/telemetry-feed-route-handler";

const fakeEvents: TelemetryFeedEvent[] = [
  {
    id: "a",
    eventType: "new_account",
    sourceModule: "Marketplace",
    payload: { accountId: 1, isApproved: false, registeredAt: "2026-11-01T17:00:00.000Z" },
    userId: 1,
    trustId: null,
    createdAt: "2026-11-01T17:00:00.000Z",
  },
  {
    id: "b",
    eventType: "onboarding_completed",
    sourceModule: "Entity Builder",
    payload: { onboardingId: 7, onboardingStatus: "submitted" },
    userId: 1,
    trustId: null,
    createdAt: "2026-11-01T17:01:00.000Z",
  },
  {
    id: "c",
    eventType: "asset_purchased",
    sourceModule: "Asset Marketplace",
    payload: { assetId: "asset-1", userId: 1, tokenPrice: 5 },
    userId: 1,
    trustId: null,
    createdAt: "2026-11-01T17:02:00.000Z",
  },
];

/** Mock listTelemetryEvents that paginates the fake events like the real DB query. */
function mockListTelemetryEvents(
  _db: unknown,
  cursor: TelemetryFeedCursor | null,
  limit: number,
): Promise<{ events: TelemetryFeedEvent[]; nextCursor: string | null }> {
  const after = fakeEvents.filter((e) => {
    if (cursor == null) return true;
    if (e.createdAt > cursor.c) return true;
    if (e.createdAt === cursor.c && e.id > cursor.i) return true;
    return false;
  });
  const page = after.slice(0, limit);
  const hasMore = after.length > limit;
  const nextCursor =
    hasMore && page.length > 0
      ? encodeTelemetryFeedCursor(page[page.length - 1])
      : null;
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

describe("telemetry feed cursor", () => {
  it("round-trips through encode and decode", () => {
    const cursor = encodeTelemetryFeedCursor({
      createdAt: "2026-11-01T17:01:00.000Z",
      id: "b",
    });
    assert.deepEqual(decodeTelemetryFeedCursor(cursor), {
      c: "2026-11-01T17:01:00.000Z",
      i: "b",
    });
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
    const req = new NextRequest(
      "http://localhost/api/admin/executive-agent/telemetry/feed?cursor=not-a-cursor",
    );
    const res = await handleTelemetryFeedGet(req, deps());
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "Invalid cursor" });
  });

  it("returns events in order and paginates without duplicates", async () => {
    const req1 = new NextRequest(
      "http://localhost/api/admin/executive-agent/telemetry/feed?limit=2",
    );
    const res1 = await handleTelemetryFeedGet(req1, deps());
    assert.equal(res1.status, 200);
    const body1 = (await res1.json()) as {
      ok: boolean;
      events: TelemetryFeedEvent[];
      nextCursor: string | null;
    };
    assert.equal(body1.ok, true);
    assert.deepEqual(
      body1.events.map((e) => e.id),
      ["a", "b"],
    );
    assert.equal(typeof body1.nextCursor, "string");

    const req2 = new NextRequest(
      `http://localhost/api/admin/executive-agent/telemetry/feed?limit=2&cursor=${encodeURIComponent(body1.nextCursor as string)}`,
    );
    const res2 = await handleTelemetryFeedGet(req2, deps());
    assert.equal(res2.status, 200);
    const body2 = (await res2.json()) as {
      ok: boolean;
      events: TelemetryFeedEvent[];
      nextCursor: string | null;
    };
    // Second page is disjoint from the first and in order.
    assert.deepEqual(
      body2.events.map((e) => e.id),
      ["c"],
    );
    assert.equal(body2.nextCursor, null);
  });

  it("returns no phone number in any event payload", async () => {
    const req = new NextRequest(
      "http://localhost/api/admin/executive-agent/telemetry/feed",
    );
    const res = await handleTelemetryFeedGet(req, deps());
    assert.equal(res.status, 200);
    const body = (await res.json()) as { events: TelemetryFeedEvent[] };
    for (const event of body.events) {
      assert.equal(
        event.payload != null && "phone" in event.payload,
        false,
        `event ${event.id} payload must not carry a phone number`,
      );
    }
  });
});
