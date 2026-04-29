/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { POST } from "./route";
import { getDb } from "@/lib/db";
import { marketplaceUsers, trusts } from "@/lib/db/schema";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;
const cookiesMock = cookies as jest.MockedFunction<typeof cookies>;
const verifyTokenMock = verifyToken as jest.MockedFunction<typeof verifyToken>;

const TRUST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_USER_ID = 777;
const USER_ID = 42;

type TrustRow = {
  id: string;
  publicId: string | null;
  clientId: string | null;
  name: string | null;
  trustType: string | null;
  userId: number;
};

function makeActiveDb(trustRow: TrustRow | null) {
  const marketplaceUpdate = jest.fn(() => ({
    where: jest.fn(() => Promise.resolve(undefined)),
  }));
  const trustsUpdate = jest.fn(() => ({
    where: jest.fn(() => Promise.resolve(undefined)),
  }));

  return {
    select: jest.fn(() => ({
      from: jest.fn((table: unknown) => {
        if (table === trusts) {
          return {
            where: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve(trustRow ? [trustRow] : [])),
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
    update: jest.fn((table: unknown) => {
      if (table === marketplaceUsers) {
        return { set: jest.fn(() => marketplaceUpdate()) };
      }
      if (table === trusts) {
        return { set: jest.fn(() => trustsUpdate()) };
      }
      return { set: jest.fn(() => ({ where: jest.fn(() => Promise.resolve()) })) };
    }),
    _marketplaceUpdate: marketplaceUpdate,
    _trustsUpdate: trustsUpdate,
  };
}

describe("POST /api/trust-records/active", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cookiesMock.mockResolvedValue({
      get: jest.fn((name: string) => (name === "auth-token" ? { value: "tok" } : undefined)),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    verifyTokenMock.mockReturnValue({ userId: USER_ID } as ReturnType<typeof verifyToken>);
  });

  it("returns 401 when there is no authenticated user", async () => {
    verifyTokenMock.mockReturnValue(null as unknown as ReturnType<typeof verifyToken>);
    const req = new Request("http://localhost/api/trust-records/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trustId: TRUST_ID }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("returns 401 when auth-token cookie is missing", async () => {
    cookiesMock.mockResolvedValue({
      get: jest.fn(() => undefined),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    const req = new Request("http://localhost/api/trust-records/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trustId: TRUST_ID }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("owned trust can be set active and returns ok payload shape", async () => {
    const trust: TrustRow = {
      id: TRUST_ID,
      publicId: "T-PUB-1",
      clientId: null,
      name: "Test",
      trustType: "revocable_living_trust",
      userId: USER_ID,
    };
    const db = makeActiveDb(trust);
    getDbMock.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const req = new Request("http://localhost/api/trust-records/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trustId: TRUST_ID, source: "dashboard" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      ok: boolean;
      active: {
        trustId: string;
        trustPublicId: string | null;
        clientId: string | null;
        clientPublicId: string | null;
        entityId: null;
        entityPublicId: string | null;
        role: string;
      };
      meta: { source: string; updatedAt: string };
    };
    expect(data.ok).toBe(true);
    expect(data.active.trustId).toBe(TRUST_ID);
    expect(data.active.trustPublicId).toBe("T-PUB-1");
    expect(data.active.entityId).toBeNull();
    expect(data.active.role).toBeDefined();
    expect(data.meta.source).toBe("dashboard");
    expect(typeof data.meta.updatedAt).toBe("string");
  });

  it("updates marketplace_users.lastActiveTrustId and bumps trusts.updatedAt", async () => {
    const trust: TrustRow = {
      id: TRUST_ID,
      publicId: null,
      clientId: null,
      name: "T",
      trustType: "revocable_living_trust",
      userId: USER_ID,
    };
    const db = makeActiveDb(trust);
    getDbMock.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const req = new Request("http://localhost/api/trust-records/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trustId: TRUST_ID }),
    });
    await POST(req as any);

    expect(db.update).toHaveBeenCalledWith(marketplaceUsers);
    expect(db.update).toHaveBeenCalledWith(trusts);
    const setCalls = (db.update as jest.Mock).mock.results
      .map((r) => r.value?.set?.mock?.calls?.[0]?.[0])
      .filter(Boolean);
    expect(setCalls.some((s: { lastActiveTrustId?: string }) => s.lastActiveTrustId === TRUST_ID)).toBe(true);
    expect(setCalls.some((s: { updatedAt?: Date }) => s.updatedAt instanceof Date)).toBe(true);
  });

  it("rejects non-owned trust with 403", async () => {
    const trust: TrustRow = {
      id: TRUST_ID,
      publicId: null,
      clientId: null,
      name: "Other",
      trustType: "revocable_living_trust",
      userId: OTHER_USER_ID,
    };
    const db = makeActiveDb(trust);
    getDbMock.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const req = new Request("http://localhost/api/trust-records/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trustId: TRUST_ID }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(403);
    expect(db.update).not.toHaveBeenCalled();
  });
});
