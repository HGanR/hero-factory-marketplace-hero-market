/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { getDb } from "@/lib/db";
import * as delivery from "@/lib/revenue-os/publish-approval-report-delivery-run";
import * as cronAuth from "@/lib/social/internal-worker-cron-auth";

jest.mock("@/lib/db");
jest.mock("@/lib/social/internal-worker-cron-auth");
jest.mock("@/lib/revenue-os/publish-approval-report-delivery-run");

describe("POST /api/internal/publish-approval-report-delivery-run", () => {
  beforeEach(() => {
    jest.mocked(cronAuth.isAuthorizedInternalCronRequest).mockReset();
    (getDb as jest.Mock).mockReset();
    jest.mocked(delivery.runPublishApprovalReportDeliveryRun).mockReset();
  });

  it("returns 401 when unauthorized", async () => {
    jest.mocked(cronAuth.isAuthorizedInternalCronRequest).mockReturnValue(false);
    const res = await POST(new NextRequest("http://localhost/api/internal/publish-approval-report-delivery-run"));
    expect(res.status).toBe(401);
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe("UNAUTHORIZED");
    expect(delivery.runPublishApprovalReportDeliveryRun).not.toHaveBeenCalled();
  });

  it("returns summary when authorized", async () => {
    jest.mocked(cronAuth.isAuthorizedInternalCronRequest).mockReturnValue(true);
    (getDb as jest.Mock).mockResolvedValue({
      insert: jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) }),
    });
    jest.mocked(delivery.runPublishApprovalReportDeliveryRun).mockResolvedValue({
      campaignsScanned: 3,
      reportsGenerated: 1,
      deliveriesCreated: 2,
      errors: 0,
      boundedErrors: [],
    });

    const res = await POST(
      new NextRequest("http://localhost/api/internal/publish-approval-report-delivery-run", {
        method: "POST",
        headers: { "x-cron-secret": "s" },
        body: JSON.stringify({ scanLimit: 80 }),
      })
    );

    expect(res.status).toBe(200);
    const j = (await res.json()) as Record<string, unknown>;
    expect(j.ok).toBe(true);
    expect(j.jobType).toBe("publish_approval_report_delivery");
    const summary = j.summary as Record<string, unknown>;
    expect(summary.campaignsScanned).toBe(3);
    expect(summary.reportsGenerated).toBe(1);
    expect(delivery.runPublishApprovalReportDeliveryRun).toHaveBeenCalledWith(
      expect.objectContaining({ insert: expect.any(Function) }),
      expect.objectContaining({ scanLimit: 80 })
    );
  });
});
