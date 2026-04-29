/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { revenueOsAccessDeniedResponse } from "@/lib/revenue-os-api-access";
import { GET as getRules, POST as postRules } from "./rules/route";
import { PATCH as patchRule, DELETE as deleteRule } from "./rules/[id]/route";
import { GET as getDiagnostics } from "./diagnostics/route";
import { POST as postAddNote } from "./add-note/route";
import { POST as postReply } from "./reply-comment/route";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

jest.mock("@/lib/api/auth", () => ({ getAuthedUserId: jest.fn() }));
jest.mock("@/lib/social/engagement/inbox-actions", () => ({
  inboxAddNote: jest.fn().mockResolvedValue({ ok: true }),
  inboxReplyToThreadComment: jest.fn(),
}));
jest.mock("@/lib/revenue-os-api-access", () => ({
  __esModule: true,
  ...jest.requireActual("@/lib/revenue-os-api-access"),
  enforceRevenueOsApiAccess: jest.fn(),
}));
jest.mock("@/lib/db", () => ({ getDb: jest.fn() }));

const ruleRow = {
  id: "11111111-1111-1111-1111-111111111111",
  userId: "user-1",
  clientId: "c1",
  name: "Test rule",
  conditionsJson: { keywordsAny: ["a"] },
  actionsJson: { addLabelSlug: "vip" },
  isActive: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-02"),
};

function mockDbForRules() {
  const getDb = jest.requireMock("@/lib/db").getDb as jest.Mock;
  getDb.mockResolvedValue({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve([ruleRow]),
        }),
      }),
    }),
    insert: () => ({
      values: () => Promise.resolve(),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    delete: () => ({
      where: () => Promise.resolve(),
    }),
  });
}

function mockDbForDiagnostics() {
  const r1: { c: number }[] = [{ c: 0 }];
  const r2: { c: number }[] = [{ c: 0 }];
  const r3: { c: number }[] = [{ c: 0 }];
  const r4: { provider: string; last: null }[] = [];
  const r5: { socialAccountId: string; provider: string; last: null }[] = [];
  const r6: { c: number }[] = [{ c: 0 }];
  const r7: never[] = [];
  const q = [r1, r2, r3, r4, r5, r6, r7];
  let n = 0;
  const getDb = jest.requireMock("@/lib/db").getDb as jest.Mock;
  getDb.mockResolvedValue({
    select: () => {
      n += 1;
      const k = n;
      if (k === 3) {
        return {
          from: () => ({
            innerJoin: () => ({
              where: () => Promise.resolve(q[2]),
            }),
          }),
        };
      }
      if (k === 4) {
        return {
          from: () => ({
            where: () => ({
              groupBy: () => Promise.resolve(q[3]),
            }),
          }),
        };
      }
      if (k === 5) {
        return {
          from: () => ({
            where: () => ({
              groupBy: () => ({
                limit: () => Promise.resolve(q[4]),
              }),
            }),
          }),
        };
      }
      if (k === 6) {
        return {
          from: () => ({
            where: () => Promise.resolve(r6),
          }),
        };
      }
      if (k === 7) {
        return {
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve(r7),
              }),
            }),
          }),
        };
      }
      return {
        from: () => ({
          where: () => Promise.resolve(q[k - 1] as (typeof r1) | (typeof r2)),
        }),
      };
    },
  });
}

const mockEnforce = enforceRevenueOsApiAccess as jest.MockedFunction<typeof enforceRevenueOsApiAccess>;
const mockAuth = getAuthedUserId as jest.MockedFunction<typeof getAuthedUserId>;

describe("Revenue OS inbox API routes (integration-style)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnforce.mockResolvedValue(null);
    mockAuth.mockResolvedValue("user-1");
  });

  it("GET /inbox/rules returns 400 without clientId", async () => {
    mockDbForRules();
    const res = await getRules(new NextRequest("http://localhost/api/revenue-os/inbox/rules"));
    expect(res.status).toBe(400);
  });

  it("GET /inbox/rules returns items when authed and db resolves", async () => {
    mockDbForRules();
    const res = await getRules(
      new NextRequest("http://localhost/api/revenue-os/inbox/rules?clientId=c1")
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { items?: { id: string; name: string; conditionsLine?: string }[] };
    expect(j.items?.length).toBe(1);
    expect(j.items?.[0]?.name).toBe("Test rule");
  });

  it("enforces Revenue OS access (403) on rules GET", async () => {
    mockEnforce.mockResolvedValue(revenueOsAccessDeniedResponse());
    const res = await getRules(
      new NextRequest("http://localhost/api/revenue-os/inbox/rules?clientId=c1")
    );
    expect(res.status).toBe(403);
  });

  it("returns 401 for diagnostics when not logged in", async () => {
    mockEnforce.mockResolvedValue(null);
    mockAuth.mockResolvedValue(null);
    const res = await getDiagnostics(
      new NextRequest("http://localhost/api/revenue-os/inbox/diagnostics?clientId=c1&days=7")
    );
    expect(res.status).toBe(401);
  });

  it("GET /inbox/diagnostics returns expected shape", async () => {
    mockDbForDiagnostics();
    const res = await getDiagnostics(
      new NextRequest("http://localhost/api/revenue-os/inbox/diagnostics?clientId=c1&days=7")
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      newThreadsInPeriod: number;
      devSeededThreadCount?: number;
      recentIngestErrors: unknown[];
      note: string;
    };
    expect(typeof j.newThreadsInPeriod).toBe("number");
    expect(j.devSeededThreadCount).toBe(0);
    expect(Array.isArray(j.recentIngestErrors)).toBe(true);
    expect(String(j.note).length).toBeGreaterThan(0);
  });

  it("POST /inbox/rules returns 200 with id", async () => {
    const getDb = jest.requireMock("@/lib/db").getDb as jest.Mock;
    getDb.mockResolvedValue({
      insert: () => ({ values: () => Promise.resolve() }),
    });
    const res = await postRules(
      new NextRequest("http://localhost/api/revenue-os/inbox/rules", {
        method: "POST",
        body: JSON.stringify({
          clientId: "c1",
          name: "R1",
          conditionsJson: { keywordsAny: ["x"] },
          actionsJson: { addLabelSlug: "a" },
        }),
      })
    );
    expect(res.status).toBe(200);
  });

  it("PATCH /inbox/rules/:id can toggle isActive", async () => {
    const getDb = jest.requireMock("@/lib/db").getDb as jest.Mock;
    getDb.mockResolvedValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([ruleRow]),
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
    });
    const res = await patchRule(
      new NextRequest("http://localhost/api/revenue-os/inbox/rules/11111111-1111-1111-1111-111111111111", {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ id: "11111111-1111-1111-1111-111111111111" }) }
    );
    expect(res.status).toBe(200);
  });

  it("DELETE /inbox/rules/:id returns 200", async () => {
    const getDb = jest.requireMock("@/lib/db").getDb as jest.Mock;
    getDb.mockResolvedValue({
      delete: () => ({
        where: () => Promise.resolve(),
      }),
    });
    const res = await deleteRule(
      new NextRequest("http://localhost/api/revenue-os/inbox/rules/11111111-1111-1111-1111-111111111111", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "11111111-1111-1111-1111-111111111111" }) }
    );
    expect(res.status).toBe(200);
  });

  it("POST /inbox/add-note delegates to inboxAddNote (mocked)", async () => {
    const getDb = jest.requireMock("@/lib/db").getDb as jest.Mock;
    getDb.mockResolvedValue({});
    const { inboxAddNote } = await import("@/lib/social/engagement/inbox-actions");
    const res = await postAddNote(
      new NextRequest("http://localhost/api/revenue-os/inbox/add-note", {
        method: "POST",
        body: JSON.stringify({ threadId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", text: "n" }),
      })
    );
    expect(res.status).toBe(200);
    expect(inboxAddNote).toHaveBeenCalled();
  });

  it("POST /inbox/reply-comment returns validation error for bad body", async () => {
    const getDb = jest.requireMock("@/lib/db").getDb as jest.Mock;
    getDb.mockResolvedValue({});
    const res = await postReply(
      new NextRequest("http://localhost/api/revenue-os/inbox/reply-comment", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });
});
