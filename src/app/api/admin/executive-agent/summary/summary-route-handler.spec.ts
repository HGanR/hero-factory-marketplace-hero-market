import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import {
  handleExecutiveAgentSummaryGet,
  shouldIncludeFullPendingMarketplaceUsers,
  type ExecutiveAgentSummaryTools,
} from "@/app/api/admin/executive-agent/summary/summary-route-handler";

const baseSummary = {
  pendingAccounts: { pendingApprox30d: 2, pendingAllTime: 3, note: "Marketplace accounts where isApproved = false." },
  approvedAccounts: { approvedActive: 10, approvedInactive: 1 },
  platform: { marketplaceUsers: 20, crmClients: 5, socialCampaigns: 2, generatedAt: "2026-05-18T00:00:00.000Z" },
  inbox: { threadsLast7d: 4 },
  bentleyBridge: { platform: { notes: [] }, clientScoped: null, generatedAt: "2026-05-18T00:00:00.000Z" },
};

const safePreview = [
  {
    displayIndex: 1,
    emailMasked: "j***@e***.com",
    usernameMasked: "ja***e",
    createdAt: "2026-05-18T14:22:00.000Z",
  },
];

const fullPreview = [
  {
    id: 42,
    email: "jane.doe@example.com",
    username: "janedoe",
    createdAt: "2026-05-18T14:22:00.000Z",
  },
];

function mockTools(preview: typeof safePreview | typeof fullPreview, onPreview?: (includeFullPii: boolean) => void) {
  return {
    getPendingAccounts: async () => baseSummary.pendingAccounts,
    getApprovedAccounts: async () => baseSummary.approvedAccounts,
    getPlatformAnalyticsSummary: async () => baseSummary.platform,
    getInboxEngagementSummary: async () => baseSummary.inbox,
    getBentleyExecutiveBridgeSummary: async () => baseSummary.bentleyBridge,
    getPendingMarketplaceUsersPreview: async (_ctx: unknown, limit: number, options?: { includeFullPii?: boolean }) => {
      assert.equal(limit, 30);
      onPreview?.(Boolean(options?.includeFullPii));
      return preview;
    },
  } satisfies ExecutiveAgentSummaryTools;
}

describe("shouldIncludeFullPendingMarketplaceUsers", () => {
  it("defaults to false", () => {
    assert.equal(shouldIncludeFullPendingMarketplaceUsers(new URLSearchParams()), false);
    assert.equal(
      shouldIncludeFullPendingMarketplaceUsers(new URLSearchParams("includePendingMarketplaceUsers=preview")),
      false,
    );
  });

  it("enables full rows only for includePendingMarketplaceUsers=full", () => {
    assert.equal(
      shouldIncludeFullPendingMarketplaceUsers(new URLSearchParams("includePendingMarketplaceUsers=full")),
      true,
    );
    assert.equal(
      shouldIncludeFullPendingMarketplaceUsers(new URLSearchParams("includePendingMarketplaceUsers=FULL")),
      true,
    );
  });
});

describe("GET /api/admin/executive-agent/summary handler", () => {
  it("returns 401 when admin auth fails", async () => {
    const req = new NextRequest("http://localhost/api/admin/executive-agent/summary");
    const res = await handleExecutiveAgentSummaryGet(req, {
      getExecutiveAdminUserId: async () => null,
      getDb: async () => {
        throw new Error("db should not be called");
      },
    });
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: "Unauthorized" });
  });

  it("returns PII-safe pendingMarketplaceUsers by default", async () => {
    let includeFullPii: boolean | undefined;
    const req = new NextRequest("http://localhost/api/admin/executive-agent/summary", {
      headers: { cookie: "admin-token=test" },
    });
    const res = await handleExecutiveAgentSummaryGet(req, {
      getExecutiveAdminUserId: async () => 7,
      getDb: async () => ({}) as never,
      tools: mockTools(safePreview, (flag) => {
        includeFullPii = flag;
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      pendingMarketplaceUsers: typeof safePreview;
      pendingAccounts: typeof baseSummary.pendingAccounts;
    };
    assert.equal(includeFullPii, false);
    assert.deepEqual(body.pendingMarketplaceUsers, safePreview);
    assert.equal("email" in body.pendingMarketplaceUsers[0], false);
    assert.equal("username" in body.pendingMarketplaceUsers[0], false);
    assert.equal(body.pendingAccounts.pendingAllTime, 3);
  });

  it("returns full pendingMarketplaceUsers when includePendingMarketplaceUsers=full", async () => {
    let includeFullPii: boolean | undefined;
    const req = new NextRequest(
      "http://localhost/api/admin/executive-agent/summary?includePendingMarketplaceUsers=full",
      { headers: { cookie: "admin-token=test" } },
    );
    const res = await handleExecutiveAgentSummaryGet(req, {
      getExecutiveAdminUserId: async () => 7,
      getDb: async () => ({}) as never,
      tools: mockTools(fullPreview, (flag) => {
        includeFullPii = flag;
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { pendingMarketplaceUsers: typeof fullPreview };
    assert.equal(includeFullPii, true);
    assert.deepEqual(body.pendingMarketplaceUsers, fullPreview);
    assert.equal(body.pendingMarketplaceUsers[0]?.email, "jane.doe@example.com");
    assert.equal(body.pendingMarketplaceUsers[0]?.username, "janedoe");
  });
});
