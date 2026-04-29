/**
 * @jest-environment node
 */
jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));
jest.mock("@/lib/db/schema", () => ({
  campaignAuditEvents: {},
  internalJobRuns: {},
}));
jest.mock("@/lib/revenue-os/internal-batch-job-run", () => {
  const actual = jest.requireActual<typeof import("@/lib/revenue-os/internal-batch-job-run")>(
    "@/lib/revenue-os/internal-batch-job-run"
  );
  return {
    ...actual,
    persistInternalJobRun: jest.fn().mockResolvedValue(undefined),
    logInternalJobRunStructured: jest.fn(),
  };
});
jest.mock("@/lib/revenue-os/campaign-governance-http-response", () => ({
  governanceUnauthorizedResponse: jest.fn(() => new Response("unauth", { status: 401 })),
  governanceInternalErrorResponse: jest.fn(() => new Response("err", { status: 500 })),
}));
jest.mock("@/lib/social/internal-worker-cron-auth", () => ({
  isAuthorizedInternalCronRequest: jest.fn(),
}));
jest.mock("@/lib/social/run-scheduled-paid-social-meta-sync", () => ({
  runScheduledPaidSocialMetaSync: jest.fn(),
}));

import { describe, it, expect, jest, beforeEach, beforeAll } from "@jest/globals";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { persistInternalJobRun } from "@/lib/revenue-os/internal-batch-job-run";
import { isAuthorizedInternalCronRequest } from "@/lib/social/internal-worker-cron-auth";
import { runScheduledPaidSocialMetaSync } from "@/lib/social/run-scheduled-paid-social-meta-sync";

let POST: typeof import("./route").POST;

beforeAll(async () => {
  ({ POST } = await import("./route"));
});

const baseRun = {
  poolScanned: 5,
  attempted: 2,
  succeeded: 2,
  failed: 0,
  successCount: 2,
  throttledCount: 0,
  authErrorCount: 0,
  deferredDueToBackoff: 0,
  deferredDueToRunBackoff: 0,
  deferredDueToPersistedBackoff: 0,
  accountsDeferredDueToPersistedBackoff: [] as string[],
  deferredDueToPerAccount: 0,
  deferredDueToMaxCampaigns: 0,
  errors: [] as string[],
  configApplied: {
    maxItems: 15,
    scanPoolLimit: 120,
    maxPerAccount: 8,
    maxCampaigns: 25,
    throttlePauseAfter: 2,
  },
};

describe("POST /api/internal/social/paid-social-meta-sync-scheduled", () => {
  beforeEach(() => {
    jest.mocked(isAuthorizedInternalCronRequest).mockReset();
    (getDb as jest.Mock).mockReset();
    jest.mocked(runScheduledPaidSocialMetaSync).mockReset();
    jest.mocked(persistInternalJobRun).mockClear();
  });

  it("returns 401 when cron auth fails", async () => {
    jest.mocked(isAuthorizedInternalCronRequest).mockReturnValue(false);
    const res = await POST(new NextRequest("http://localhost/api/internal/social/paid-social-meta-sync-scheduled"));
    expect(res.status).toBe(401);
  });

  it("returns normalized job payload and persists internal job run when authorized", async () => {
    jest.mocked(isAuthorizedInternalCronRequest).mockReturnValue(true);
    const values = jest.fn().mockResolvedValue(undefined);
    const insert = jest.fn().mockReturnValue({ values });
    (getDb as jest.Mock).mockResolvedValue({ insert });
    jest.mocked(runScheduledPaidSocialMetaSync).mockResolvedValue({
      skipped: false,
      ...baseRun,
    });
    const res = await POST(new NextRequest("http://localhost/api/internal/social/paid-social-meta-sync-scheduled"));
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      ok: boolean;
      jobType: string;
      summary: { attempted: number; deferredDueToPersistedBackoff: number; throttledCount: number; successCount: number };
    };
    expect(j.ok).toBe(true);
    expect(j.jobType).toBe("paid_social_meta_sync_scheduled");
    expect(j.summary.attempted).toBe(2);
    expect(j.summary.successCount).toBe(2);
    expect(j.summary.throttledCount).toBe(0);
    expect(j.summary.deferredDueToPersistedBackoff).toBe(0);
    expect(insert).toHaveBeenCalled();
    expect(values).toHaveBeenCalledTimes(1);
    expect(persistInternalJobRun).toHaveBeenCalled();
    const persisted = jest.mocked(persistInternalJobRun).mock.calls[0]?.[1] as { summary: Record<string, unknown> };
    expect(persisted?.summary).toMatchObject({
      successCount: 2,
      throttledCount: 0,
      authErrorCount: 0,
      deferredDueToRunBackoff: 0,
      deferredDueToPersistedBackoff: 0,
    });
  });

  it("does not audit campaign events when run skipped but still persists job run", async () => {
    jest.mocked(isAuthorizedInternalCronRequest).mockReturnValue(true);
    const values = jest.fn().mockResolvedValue(undefined);
    const insert = jest.fn().mockReturnValue({ values });
    (getDb as jest.Mock).mockResolvedValue({ insert });
    jest.mocked(runScheduledPaidSocialMetaSync).mockResolvedValue({
      skipped: true,
      reason: "flag",
      poolScanned: 0,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      successCount: 0,
      throttledCount: 0,
      authErrorCount: 0,
      deferredDueToBackoff: 0,
      deferredDueToRunBackoff: 0,
      deferredDueToPersistedBackoff: 0,
      accountsDeferredDueToPersistedBackoff: [],
      deferredDueToPerAccount: 0,
      deferredDueToMaxCampaigns: 0,
      errors: [],
      configApplied: baseRun.configApplied,
    });
    const res = await POST(new NextRequest("http://localhost/api/internal/social/paid-social-meta-sync-scheduled"));
    expect(res.status).toBe(200);
    expect(values).not.toHaveBeenCalled();
    expect(persistInternalJobRun).toHaveBeenCalled();
  });
});
