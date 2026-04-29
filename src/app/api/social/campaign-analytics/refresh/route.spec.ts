/**
 * @jest-environment node
 */
jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));
jest.mock("@/lib/revenue-os-api-access", () => ({
  enforceRevenueOsApiAccess: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/lib/revenue-os/get-campaign-reviewer-access");
jest.mock("@/lib/social/governed-post-analytics-batch-refresh", () => ({
  runCampaignGovernedPostAnalyticsBatchRefresh: jest.fn(),
  insertGovernedPostAnalyticsBatchRefreshAudit: jest.fn().mockResolvedValue(undefined),
}));

import { describe, it, expect, jest, beforeEach, beforeAll } from "@jest/globals";
import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import {
  insertGovernedPostAnalyticsBatchRefreshAudit,
  runCampaignGovernedPostAnalyticsBatchRefresh,
} from "@/lib/social/governed-post-analytics-batch-refresh";

const CAMP = "11111111-1111-4111-8111-111111111111";

let POST: typeof import("./route").POST;

beforeAll(async () => {
  ({ POST } = await import("./route"));
});

describe("/api/social/campaign-analytics/refresh POST", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset();
    jest.mocked(getAuthedUserId).mockResolvedValue(1);
    (getDb as jest.Mock).mockReset();
    (getDb as jest.Mock).mockResolvedValue({});
    jest.mocked(enforceRevenueOsApiAccess).mockReset();
    jest.mocked(enforceRevenueOsApiAccess).mockResolvedValue(null);
    jest.mocked(getCampaignReviewerAccess).mockReset();
    jest.mocked(runCampaignGovernedPostAnalyticsBatchRefresh).mockReset();
    jest.mocked(insertGovernedPostAnalyticsBatchRefreshAudit).mockReset();
    jest.mocked(insertGovernedPostAnalyticsBatchRefreshAudit).mockResolvedValue(undefined);
  });

  it("returns 400 for invalid body", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/social/campaign-analytics/refresh", {
        method: "POST",
        body: JSON.stringify({ campaignId: "bad" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 without campaign access", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue(null);
    const res = await POST(
      new NextRequest("http://localhost/api/social/campaign-analytics/refresh", {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(404);
    expect(runCampaignGovernedPostAnalyticsBatchRefresh).not.toHaveBeenCalled();
  });

  it("runs batch, writes audit, returns counts", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP, name: "N" } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    jest.mocked(runCampaignGovernedPostAnalyticsBatchRefresh).mockResolvedValue({
      campaignId: CAMP,
      limitRequested: 25,
      limitApplied: 25,
      attemptedCount: 2,
      succeededCount: 2,
      failedCount: 0,
      skippedCount: 3,
      skippedBreakdown: {
        unpublished: 1,
        unsupported_provider: 2,
        missing_remote_post_id: 0,
        deferred_due_to_batch_limit: 0,
      },
      refreshedPostIds: ["a", "b"],
      failures: [],
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:01.000Z",
      durationMs: 1000,
    });

    const res = await POST(
      new NextRequest("http://localhost/api/social/campaign-analytics/refresh", {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP, limit: 40 }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok: boolean; succeededCount: number };
    expect(j.ok).toBe(true);
    expect(j.succeededCount).toBe(2);
    expect(runCampaignGovernedPostAnalyticsBatchRefresh).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId: CAMP, limit: 40 })
    );
    expect(insertGovernedPostAnalyticsBatchRefreshAudit).toHaveBeenCalled();
  });

  it("returns 403 when Revenue OS gate blocks", async () => {
    jest.mocked(enforceRevenueOsApiAccess).mockResolvedValueOnce(
      NextResponse.json({ error: "REVENUE_OS_ACCESS_DENIED" }, { status: 403 })
    );
    const res = await POST(
      new NextRequest("http://localhost/api/social/campaign-analytics/refresh", {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(403);
  });
});
