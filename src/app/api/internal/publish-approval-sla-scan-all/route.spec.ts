/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { getDb } from "@/lib/db";
import * as batch from "@/lib/revenue-os/publish-approval-sla-scan-batch";
import * as cronAuth from "@/lib/social/internal-worker-cron-auth";

jest.mock("@/lib/db");
jest.mock("@/lib/social/internal-worker-cron-auth");
jest.mock("@/lib/revenue-os/publish-approval-sla-scan-batch");

describe("POST /api/internal/publish-approval-sla-scan-all", () => {
  beforeEach(() => {
    jest.mocked(cronAuth.isAuthorizedInternalCronRequest).mockReset();
    (getDb as jest.Mock).mockReset();
    jest.mocked(batch.runPublishApprovalSlaScanAllCampaigns).mockReset();
  });

  it("returns 401 when cron auth fails", async () => {
    jest.mocked(cronAuth.isAuthorizedInternalCronRequest).mockReturnValue(false);
    const res = await POST(new NextRequest("http://localhost/api/internal/publish-approval-sla-scan-all"));
    expect(res.status).toBe(401);
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe("UNAUTHORIZED");
    expect(batch.runPublishApprovalSlaScanAllCampaigns).not.toHaveBeenCalled();
  });

  it("returns 200 with batch summary when authorized", async () => {
    jest.mocked(cronAuth.isAuthorizedInternalCronRequest).mockReturnValue(true);
    (getDb as jest.Mock).mockResolvedValue({
      insert: jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) }),
    });
    jest.mocked(batch.runPublishApprovalSlaScanAllCampaigns).mockResolvedValue({
      campaignsScanned: 2,
      postsChecked: 10,
      remindersCreated: 1,
      campaignsSkipped: 3,
      errors: 0,
      approvalGateDisabled: false,
      boundedErrors: [],
    });

    const res = await POST(
      new NextRequest("http://localhost/api/internal/publish-approval-sla-scan-all", {
        method: "POST",
        headers: { "x-cron-secret": "s" },
        body: JSON.stringify({ maxCampaigns: 15, workerRequiresApproval: true }),
      })
    );

    expect(res.status).toBe(200);
    const j = (await res.json()) as Record<string, unknown>;
    expect(j.ok).toBe(true);
    expect(j.jobType).toBe("publish_approval_sla_scan_all");
    expect(typeof j.durationMs).toBe("number");
    const summary = j.summary as Record<string, unknown>;
    expect(summary.campaignsScanned).toBe(2);
    expect(summary.remindersCreated).toBe(1);
    expect(summary.campaignsSkipped).toBe(3);
    expect(batch.runPublishApprovalSlaScanAllCampaigns).toHaveBeenCalledWith(
      expect.objectContaining({ insert: expect.any(Function) }),
      expect.objectContaining({ maxCampaigns: 15, workerRequiresApproval: true })
    );
  });
});
