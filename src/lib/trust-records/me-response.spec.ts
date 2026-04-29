/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { buildTrustRecordsMeResponse } from "./me-response";
import { getDb } from "@/lib/db";
import { marketplaceUsers, trusts } from "@/lib/db/schema";

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
  withDbTimeout: (p: Promise<unknown>) => p,
}));

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;

const USER_ID = 42;
const EXPLICIT_TRUST_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FALLBACK_TRUST_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type MeTrustRow = {
  id: string;
  publicId: string | null;
  clientId: string | null;
  name: string | null;
  trustType: string | null;
};

function makeMeDb(opts: {
  userLastActive: string | null | undefined;
  explicitRows: MeTrustRow[];
  fallbackRows: MeTrustRow[];
  fromTables?: unknown[];
}) {
  const fromTables = opts.fromTables ?? [];
  return {
    select: jest.fn(() => ({
      from: jest.fn((table: unknown) => {
        fromTables.push(table);
        if (table === marketplaceUsers) {
          return {
            where: jest.fn(() => ({
              limit: jest.fn(() =>
                Promise.resolve([{ lastActiveTrustId: opts.userLastActive ?? null }])
              ),
            })),
          };
        }
        if (table === trusts) {
          return {
            where: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve(opts.explicitRows)),
              orderBy: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve(opts.fallbackRows)),
              })),
            })),
          };
        }
        return {
          where: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve([])),
          })),
        };
      }),
    })),
  };
}

function expectActivePayloadKeys(data: { active: Record<string, unknown> }) {
  expect(Object.keys(data.active).sort()).toEqual(
    ["clientId", "clientPublicId", "entityId", "entityPublicId", "role", "trustId", "trustPublicId"].sort()
  );
}

describe("buildTrustRecordsMeResponse", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resolves explicit lastActiveTrustId first when valid and sets meta.source db_last_active_explicit", async () => {
    const explicit: MeTrustRow = {
      id: EXPLICIT_TRUST_ID,
      publicId: "P-EXP",
      clientId: null,
      name: "Explicit",
      trustType: "revocable_living_trust",
    };
    const db = makeMeDb({
      userLastActive: EXPLICIT_TRUST_ID,
      explicitRows: [explicit],
      fallbackRows: [
        {
          id: FALLBACK_TRUST_ID,
          publicId: "P-FB",
          clientId: null,
          name: "Fallback",
          trustType: "revocable_living_trust",
        },
      ],
    });
    getDbMock.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const out = await buildTrustRecordsMeResponse(USER_ID);
    expect(out.ok).toBe(true);
    expect(out.status).toBe(200);
    const data = out.body as {
      ok: boolean;
      active: { trustId: string | null };
      meta: { source: string };
    };
    expect(data.ok).toBe(true);
    expect(data.active.trustId).toBe(EXPLICIT_TRUST_ID);
    expect(data.meta.source).toBe("db_last_active_explicit");
    expectActivePayloadKeys(data);
  });

  it("null pointer falls back to most recently updated trust and meta.source db_last_used", async () => {
    const fallback: MeTrustRow = {
      id: FALLBACK_TRUST_ID,
      publicId: null,
      clientId: null,
      name: "Latest",
      trustType: "revocable_living_trust",
    };
    const db = makeMeDb({
      userLastActive: null,
      explicitRows: [],
      fallbackRows: [fallback],
    });
    getDbMock.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const out = await buildTrustRecordsMeResponse(USER_ID);
    expect(out.ok).toBe(true);
    const data = out.body as { active: { trustId: string | null }; meta: { source: string } };
    expect(data.active.trustId).toBe(FALLBACK_TRUST_ID);
    expect(data.meta.source).toBe("db_last_used");
    expectActivePayloadKeys(data);
  });

  it("explicit pointer that does not match an owned trust falls back to db_last_used", async () => {
    const fallback: MeTrustRow = {
      id: FALLBACK_TRUST_ID,
      publicId: null,
      clientId: null,
      name: "FB",
      trustType: "revocable_living_trust",
    };
    const db = makeMeDb({
      userLastActive: "deleted-or-missing-uuid-000000000000",
      explicitRows: [],
      fallbackRows: [fallback],
    });
    getDbMock.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const out = await buildTrustRecordsMeResponse(USER_ID);
    expect(out.ok).toBe(true);
    const data = out.body as { active: { trustId: string | null }; meta: { source: string } };
    expect(data.active.trustId).toBe(FALLBACK_TRUST_ID);
    expect(data.meta.source).toBe("db_last_used");
  });

  it("uses only one trusts select when explicit resolution succeeds (no fallback query)", async () => {
    const explicit: MeTrustRow = {
      id: EXPLICIT_TRUST_ID,
      publicId: null,
      clientId: null,
      name: "E",
      trustType: "revocable_living_trust",
    };
    const fromTables: unknown[] = [];
    const db = makeMeDb({
      userLastActive: EXPLICIT_TRUST_ID,
      explicitRows: [explicit],
      fallbackRows: [],
      fromTables,
    });
    getDbMock.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    await buildTrustRecordsMeResponse(USER_ID);

    expect(fromTables.filter((t) => t === trusts).length).toBe(1);
  });

  it("ok response keeps stable active shape aside from meta.source", async () => {
    const db = makeMeDb({
      userLastActive: null,
      explicitRows: [],
      fallbackRows: [
        {
          id: FALLBACK_TRUST_ID,
          publicId: "P1",
          clientId: null,
          name: "N",
          trustType: null,
        },
      ],
    });
    getDbMock.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);
    const out = await buildTrustRecordsMeResponse(USER_ID);
    const data = out.body as {
      ok: boolean;
      active: {
        trustId: string | null;
        trustPublicId: string | null;
        clientId: string | null;
        clientPublicId: string | null;
        entityId: null;
        entityPublicId: string | null;
        role: string;
      };
      meta: { source: string; updatedAt: string | null };
    };
    expect(data.ok).toBe(true);
    expect(data.active.entityId).toBeNull();
    expect(typeof data.active.role).toBe("string");
    expect(data.meta.source).toMatch(/db_last_active_explicit|db_last_used/);
    expect(data.meta).toHaveProperty("updatedAt");
  });
});
