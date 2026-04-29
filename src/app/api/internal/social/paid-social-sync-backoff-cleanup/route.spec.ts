/**
 * @jest-environment node
 */
jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
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
jest.mock("@/lib/social/run-paid-social-sync-backoff-cleanup", () => ({
  runPaidSocialSyncBackoffCleanup: jest.fn(),
  PAID_SOCIAL_BACKOFF_CLEANUP_MAX_DELETE_HARD: 5000,
}));

import { describe, it, expect, jest, beforeEach, beforeAll } from "@jest/globals";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { persistInternalJobRun } from "@/lib/revenue-os/internal-batch-job-run";
import { isAuthorizedInternalCronRequest } from "@/lib/social/internal-worker-cron-auth";
import { runPaidSocialSyncBackoffCleanup } from "@/lib/social/run-paid-social-sync-backoff-cleanup";

let POST: typeof import("./route").POST;

beforeAll(async () => {
  ({ POST } = await import("./route"));
});

describe("POST /api/internal/social/paid-social-sync-backoff-cleanup", () => {
  beforeEach(() => {
    jest.mocked(isAuthorizedInternalCronRequest).mockReset();
    (getDb as jest.Mock).mockReset();
    jest.mocked(runPaidSocialSyncBackoffCleanup).mockReset();
    jest.mocked(persistInternalJobRun).mockClear();
  });

  it("returns 401 when cron auth fails", async () => {
    jest.mocked(isAuthorizedInternalCronRequest).mockReturnValue(false);
    const res = await POST(new NextRequest("http://localhost/api/internal/social/paid-social-sync-backoff-cleanup"));
    expect(res.status).toBe(401);
  });

  it("returns normalized job payload and persists internal job run when authorized", async () => {
    jest.mocked(isAuthorizedInternalCronRequest).mockReturnValue(true);
    (getDb as jest.Mock).mockResolvedValue({});
    jest.mocked(runPaidSocialSyncBackoffCleanup).mockResolvedValue({
      scannedCount: 3,
      deletedCount: 3,
      limitApplied: 500,
    });
    const res = await POST(
      new NextRequest("http://localhost/api/internal/social/paid-social-sync-backoff-cleanup", {
        method: "POST",
        body: JSON.stringify({ limit: 100 }),
        headers: { "x-cron-secret": "good", "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      ok: boolean;
      jobType: string;
      summary: { scannedCount: number; deletedCount: number; limitApplied: number };
    };
    expect(j.ok).toBe(true);
    expect(j.jobType).toBe("paid_social_sync_backoff_cleanup");
    expect(j.summary.scannedCount).toBe(3);
    expect(j.summary.deletedCount).toBe(3);
    expect(j.summary.limitApplied).toBe(500);
    expect(runPaidSocialSyncBackoffCleanup).toHaveBeenCalledWith({}, { limit: 100 });
    expect(persistInternalJobRun).toHaveBeenCalled();
  });
});
