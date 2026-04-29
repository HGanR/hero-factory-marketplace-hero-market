/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { runPublishApprovalReportDeliveryRun } from "@/lib/revenue-os/publish-approval-report-delivery-run";
import * as notif from "@/lib/revenue-os/publish-approval-report-delivery-notification";
import { campaignReviewerAssignments, campaigns } from "@/lib/db/schema";

jest.mock("@/lib/revenue-os/publish-approval-report-delivery-notification", () => ({
  createPublishApprovalComplianceReportDeliveryNotifications: jest.fn(async () => 2),
}));

function mockDbForDelivery(row: {
  id: string;
  userId: string;
  clientId: string;
  name: string;
  publishApprovalReportScheduleJson: unknown;
}) {
  return {
    select: jest.fn(() => ({
      from: jest.fn((tbl: unknown) => {
        if (tbl === campaigns) {
          return {
            where: jest.fn(() => ({
              limit: jest.fn(async () => [row]),
            })),
          };
        }
        if (tbl === campaignReviewerAssignments) {
          return {
            where: jest.fn(async () => []),
          };
        }
        return { where: jest.fn(async () => []) };
      }),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(async () => {}),
      })),
    })),
  };
}

describe("runPublishApprovalReportDeliveryRun", () => {
  beforeEach(() => {
    jest.mocked(notif.createPublishApprovalComplianceReportDeliveryNotifications).mockClear();
  });

  it("aggregates summary counts", async () => {
    const schedule = {
      enabled: true,
      frequency: "daily" as const,
      format: "json" as const,
      recipientMode: "owner_only" as const,
    };
    const db = mockDbForDelivery({
      id: "c1",
      userId: "1",
      clientId: "cl",
      name: "N",
      publishApprovalReportScheduleJson: schedule,
    });

    const s = await runPublishApprovalReportDeliveryRun(db as never, {
      now: new Date("2026-04-05T12:00:00.000Z"),
      scanLimit: 50,
    });

    expect(s.campaignsScanned).toBe(1);
    expect(s.reportsGenerated).toBe(1);
    expect(s.deliveriesCreated).toBe(2);
    expect(s.errors).toBe(0);
    expect(s.boundedErrors).toEqual([]);
    expect(notif.createPublishApprovalComplianceReportDeliveryNotifications).toHaveBeenCalledTimes(1);
  });

  it("skips when not due (same window)", async () => {
    const schedule = {
      enabled: true,
      frequency: "daily" as const,
      format: "json" as const,
      recipientMode: "owner_only" as const,
      lastDeliveryWindowKey: "2026-04-05",
    };
    const db = mockDbForDelivery({
      id: "c1",
      userId: "1",
      clientId: "cl",
      name: "N",
      publishApprovalReportScheduleJson: schedule,
    });
    (db as { update: jest.Mock }).update.mockReset();

    const s = await runPublishApprovalReportDeliveryRun(db as never, {
      now: new Date("2026-04-05T18:00:00.000Z"),
    });

    expect(s.reportsGenerated).toBe(0);
    expect(s.deliveriesCreated).toBe(0);
    expect(s.boundedErrors).toEqual([]);
    expect(notif.createPublishApprovalComplianceReportDeliveryNotifications).not.toHaveBeenCalled();
  });

  it("counts error when owner user id missing", async () => {
    const schedule = {
      enabled: true,
      frequency: "daily" as const,
      format: "json" as const,
      recipientMode: "owner_only" as const,
    };
    const db = mockDbForDelivery({
      id: "c1",
      userId: "0",
      clientId: "cl",
      name: "N",
      publishApprovalReportScheduleJson: schedule,
    });

    const s = await runPublishApprovalReportDeliveryRun(db as never, {
      now: new Date("2026-04-05T12:00:00.000Z"),
    });

    expect(s.errors).toBe(1);
    expect(s.reportsGenerated).toBe(0);
    expect(s.boundedErrors.some((e) => e.campaignId === "c1")).toBe(true);
  });
});
