/**
 * @jest-environment node
 */
jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));
jest.mock("@/lib/social/internal-worker-cron-auth", () => ({
  isAuthorizedInternalCronRequest: jest.fn(),
}));
jest.mock("@/lib/social/run-scheduled-governed-post-analytics-refresh", () => ({
  runScheduledGovernedPostAnalyticsRefresh: jest.fn(),
  SCHEDULED_GOVERNED_ANALYTICS_MAX_SCAN_POOL_LIMIT: 2000,
  SCHEDULED_GOVERNED_ANALYTICS_MAX_POSTS_HARD: 200,
  SCHEDULED_GOVERNED_ANALYTICS_MAX_POSTS_PER_CAMPAIGN_HARD: 50,
  SCHEDULED_GOVERNED_ANALYTICS_MAX_CAMPAIGNS_HARD: 200,
  SCHEDULED_GOVERNED_ANALYTICS_MAX_PER_PROVIDER_HARD: 100,
  SCHEDULED_GOVERNED_ANALYTICS_THROTTLE_PAUSE_AFTER_MIN: 1,
  SCHEDULED_GOVERNED_ANALYTICS_THROTTLE_PAUSE_AFTER_HARD: 30,
}));
jest.mock("@/lib/revenue-os/internal-batch-job-run", () => {
  const mod = jest.requireActual<typeof import("@/lib/revenue-os/internal-batch-job-run")>(
    "@/lib/revenue-os/internal-batch-job-run"
  );
  return {
    ...mod,
    persistInternalJobRun: jest.fn().mockResolvedValue(undefined),
    logInternalJobRunStructured: jest.fn(),
  };
});

import { describe, it, expect, jest, beforeEach, beforeAll } from "@jest/globals";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { isAuthorizedInternalCronRequest } from "@/lib/social/internal-worker-cron-auth";
import { runScheduledGovernedPostAnalyticsRefresh } from "@/lib/social/run-scheduled-governed-post-analytics-refresh";

let POST: typeof import("./route").POST;

beforeAll(async () => {
  ({ POST } = await import("./route"));
});

describe("/api/internal/social/governed-post-analytics-scheduled-refresh POST", () => {
  beforeEach(() => {
    jest.mocked(isAuthorizedInternalCronRequest).mockReset();
    (getDb as jest.Mock).mockReset();
    (getDb as jest.Mock).mockResolvedValue({});
    jest.mocked(runScheduledGovernedPostAnalyticsRefresh).mockReset();
  });

  it("returns 401 when not authorized", async () => {
    jest.mocked(isAuthorizedInternalCronRequest).mockReturnValue(false);
    const res = await POST(
      new NextRequest("http://localhost/api/internal/social/governed-post-analytics-scheduled-refresh", {
        method: "POST",
        headers: { "x-cron-secret": "bad" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns normalized job payload with enriched summary when authorized", async () => {
    jest.mocked(isAuthorizedInternalCronRequest).mockReturnValue(true);
    jest.mocked(runScheduledGovernedPostAnalyticsRefresh).mockResolvedValue({
      ok: true,
      scanPoolLimit: 500,
      poolScanned: 0,
      eligibleInPool: 0,
      skippedInPool: 0,
      campaignsInPool: 0,
      campaignsTouched: 0,
      attemptedCount: 0,
      succeededCount: 0,
      failedCount: 0,
      throttledCount: 0,
      deferredDueToBatchLimit: 0,
      deferredDueToCampaignLimit: 0,
      deferredDueToMaxCampaigns: 0,
      deferredDueToPerProviderCap: 0,
      deferredDueToProviderBackoff: 0,
      durationMs: 1,
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:00.000Z",
      maxPostsApplied: 40,
      maxPostsPerCampaignApplied: 10,
      maxCampaignsApplied: 25,
      maxPerProviderApplied: 20,
      throttlePauseAfterApplied: 2,
      perProviderSummary: {},
      failureSamples: [],
    });

    const res = await POST(
      new NextRequest("http://localhost/api/internal/social/governed-post-analytics-scheduled-refresh", {
        method: "POST",
        body: JSON.stringify({ maxPosts: 10, maxPerProvider: 5 }),
        headers: { "x-cron-secret": "good", "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      ok: boolean;
      jobType: string;
      summary: { attemptedCount: number; errors: number };
    };
    expect(j.ok).toBe(true);
    expect(j.jobType).toBe("governed_post_analytics_scheduled_refresh");
    expect(j.summary.attemptedCount).toBe(0);
    expect(j.summary.errors).toBe(0);
    expect(runScheduledGovernedPostAnalyticsRefresh).toHaveBeenCalledWith(
      {},
      { maxPosts: 10, maxPerProvider: 5 }
    );
  });
});
