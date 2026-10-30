/**
 * Safeguard tests for POST /api/world-assets/[assetId]/purchase.
 *
 * The purchase route must reject priced assets until server-side payment
 * verification exists. These tests use mocked database/auth layers: no live
 * database is contacted. The route module under test is the real one.
 */
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { POST } from "./route";
import { getDb } from "@/lib/db";
import { getAuthedUserId } from "@/lib/api/auth";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body,
      json: async () => body,
    }),
  },
  NextRequest: class {},
}));

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));

jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(),
}));

jest.mock("@/lib/workflow-engine/emit-platform-event", () => ({
  emitPlatformEvent: jest.fn(async () => undefined),
}));

const mockGetDb = getDb as unknown as jest.Mock;
const mockGetAuthedUserId = getAuthedUserId as unknown as jest.Mock;

let queuedSelects: unknown[][];
let inserted: unknown[];

function makeWhere(rows: unknown[]) {
  const promise = Promise.resolve(rows);
  return Object.assign(promise, { limit: async () => rows });
}

function fakeDb() {
  return {
    select: () => ({
      from: () => ({
        where: () => makeWhere((queuedSelects.shift() ?? []) as unknown[]),
      }),
    }),
    insert: () => ({
      values: async (v: unknown) => {
        inserted.push(v);
        return v;
      },
    }),
  };
}

function requestWith(body: unknown) {
  return { json: async () => body } as never;
}

function paramsFor(assetId: string) {
  return { params: Promise.resolve({ assetId }) } as never;
}

const pricedAsset = {
  id: "asset-priced",
  status: "published",
  isActive: true,
  isPlatformOnly: false,
  tokenPrice: 5,
  supplyLimit: null,
};

const freeAsset = {
  id: "asset-free",
  status: "published",
  isActive: true,
  isPlatformOnly: false,
  tokenPrice: 0,
  supplyLimit: 10,
};

describe("purchase safeguard", () => {
  beforeEach(() => {
    queuedSelects = [];
    inserted = [];
    jest.clearAllMocks();
    mockGetDb.mockResolvedValue(fakeDb());
    mockGetAuthedUserId.mockResolvedValue(7);
  });

  it("rejects an unpaid purchase of a priced asset and creates no ownership", async () => {
    queuedSelects = [[pricedAsset], []];
    const res = await POST(requestWith({}), paramsFor("asset-priced"));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error?: string; code?: string };
    expect(body.code).toBe("PAYMENT_VERIFICATION_UNAVAILABLE");
    expect(body.error).toMatch(/payment verification/);
    expect(inserted).toHaveLength(0);
  });

  it("rejects a priced purchase even when the caller supplies a transaction reference", async () => {
    queuedSelects = [[pricedAsset], []];
    const res = await POST(
      requestWith({ txRef: "0xdeadbeef" }),
      paramsFor("asset-priced")
    );
    expect(res.status).toBe(503);
    expect(inserted).toHaveLength(0);
  });

  it("preserves the free-asset path: ownership is created", async () => {
    queuedSelects = [[freeAsset], [], [{ id: "other" }, { id: "another" }]];
    const res = await POST(requestWith({}), paramsFor("asset-free"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success?: boolean;
      ownershipId?: string;
    };
    expect(body.success).toBe(true);
    expect(body.ownershipId).toBeTruthy();
    expect(inserted).toHaveLength(1);
  });

  it("preserves existing ownership of a priced asset without creating a duplicate", async () => {
    queuedSelects = [[pricedAsset], [{ id: "own-1" }]];
    const res = await POST(requestWith({}), paramsFor("asset-priced"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { alreadyOwned?: boolean };
    expect(body.alreadyOwned).toBe(true);
    expect(inserted).toHaveLength(0);
  });

  it("still requires sign-in", async () => {
    mockGetAuthedUserId.mockResolvedValue(null);
    queuedSelects = [[freeAsset], []];
    const res = await POST(requestWith({}), paramsFor("asset-free"));
    expect(res.status).toBe(401);
    expect(inserted).toHaveLength(0);
  });

  it("returns 404 for an unknown asset", async () => {
    queuedSelects = [[], []];
    const res = await POST(requestWith({}), paramsFor("missing"));
    expect(res.status).toBe(404);
    expect(inserted).toHaveLength(0);
  });
});
