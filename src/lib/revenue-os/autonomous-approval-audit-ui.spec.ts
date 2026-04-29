import type { ApprovalRequestRow } from "@/lib/revenue-os/autonomous-approval-queue";
import type { AutonomousAuditRow } from "@/lib/revenue-os/autonomous-audit";

jest.mock("@/lib/revenue-os/autonomous-approval-queue", () => ({
  listBentleyApprovalRequests: jest.fn(),
}));

jest.mock("@/lib/revenue-os/autonomous-audit", () => ({
  listBentleyAutonomousAuditEntries: jest.fn(),
  summarizeBentleyAutonomousAudit: jest.fn(),
}));

import { listBentleyApprovalRequests } from "@/lib/revenue-os/autonomous-approval-queue";
import { listBentleyAutonomousAuditEntries, summarizeBentleyAutonomousAudit } from "@/lib/revenue-os/autonomous-audit";
import { buildAutonomousApprovalUiPayload } from "@/lib/revenue-os/autonomous-approval-ui";
import { buildAutonomousAuditUiPayload } from "@/lib/revenue-os/autonomous-audit-ui";

const mockListApprovals = listBentleyApprovalRequests as jest.MockedFunction<typeof listBentleyApprovalRequests>;
const mockListAudit = listBentleyAutonomousAuditEntries as jest.MockedFunction<typeof listBentleyAutonomousAuditEntries>;
const mockSummarizeAudit = summarizeBentleyAutonomousAudit as jest.MockedFunction<typeof summarizeBentleyAutonomousAudit>;

function approvalRow(partial: Partial<ApprovalRequestRow> & Pick<ApprovalRequestRow, "id">): ApprovalRequestRow {
  const now = new Date();
  return {
    autonomousRunId: null,
    userId: "u1",
    clientId: "c1",
    trustId: "t1",
    actionType: "auto_archive_stale_draft",
    approvalStatus: "pending",
    severity: "warning",
    reason: "stale",
    rationaleJson: null,
    decisionPayloadJson: { candidate: { queueId: "q1" } },
    targetIdsJson: ["q1"],
    requestedAt: now,
    reviewedAt: null,
    reviewedByUserId: null,
    reviewNote: null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  } as ApprovalRequestRow;
}

function auditRow(partial: Partial<AutonomousAuditRow> & Pick<AutonomousAuditRow, "id">): AutonomousAuditRow {
  const now = new Date();
  return {
    userId: "u1",
    clientId: "c1",
    trustId: "t1",
    sourceType: "autonomous_engine",
    actionType: "auto_archive_stale_draft",
    actionStatus: "executed",
    relatedRunId: null,
    relatedApprovalRequestId: null,
    targetIdsJson: null,
    actionPayloadJson: null,
    resultPayloadJson: null,
    rationaleJson: null,
    createdAt: now,
    ...partial,
  } as AutonomousAuditRow;
}

describe("buildAutonomousApprovalUiPayload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListApprovals.mockResolvedValue([]);
  });

  it("returns empty structures for blank userId", async () => {
    const p = await buildAutonomousApprovalUiPayload({ userId: "  ", generatedAt: "2026-01-01T00:00:00.000Z" });
    expect(p.pendingApprovals).toEqual([]);
    expect(p.bySeverity).toEqual({});
    expect(p.actionPreviewCards).toEqual([]);
    expect(mockListApprovals).not.toHaveBeenCalled();
  });

  it("groups pending by severity and action type", async () => {
    mockListApprovals.mockResolvedValue([
      approvalRow({ id: "a1", severity: "warning", actionType: "auto_archive_stale_draft" }),
      approvalRow({ id: "a2", severity: "critical", actionType: "retry_publish" }),
    ]);
    const p = await buildAutonomousApprovalUiPayload({ userId: "u1", generatedAt: "g" });
    expect(p.pendingApprovals).toHaveLength(2);
    expect(p.bySeverity.warning).toHaveLength(1);
    expect(p.bySeverity.critical).toHaveLength(1);
    expect(p.byActionType.auto_archive_stale_draft).toBe(1);
    expect(p.byActionType.retry_publish).toBe(1);
    expect(p.actionPreviewCards[0]?.title).toMatch(/archive/i);
  });

  it("flags expiring soon when expiresAt within 48h", async () => {
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);
    mockListApprovals.mockResolvedValue([
      approvalRow({ id: "e1", approvalStatus: "pending", expiresAt: soon }),
    ]);
    const p = await buildAutonomousApprovalUiPayload({ userId: "u1", generatedAt: "g" });
    expect(p.expiringSoon).toHaveLength(1);
    expect(p.expiringSoon[0]?.id).toBe("e1");
  });

  it("lists recently approved and rejected", async () => {
    mockListApprovals.mockResolvedValue([
      approvalRow({
        id: "ap1",
        approvalStatus: "approved",
        reviewedAt: new Date("2026-01-02T00:00:00.000Z"),
      }),
      approvalRow({
        id: "rj1",
        approvalStatus: "rejected",
        reviewedAt: new Date("2026-01-03T00:00:00.000Z"),
      }),
    ]);
    const p = await buildAutonomousApprovalUiPayload({ userId: "u1", generatedAt: "g" });
    expect(p.recentlyApproved.map((x) => x.id)).toContain("ap1");
    expect(p.recentlyRejected.map((x) => x.id)).toContain("rj1");
  });
});

describe("buildAutonomousAuditUiPayload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListAudit.mockResolvedValue([]);
    mockSummarizeAudit.mockResolvedValue({
      total: 0,
      byStatus: {},
      executedCount: 0,
      failedCount: 0,
      rejectedCount: 0,
      approvalRequiredCount: 0,
      summaryLine: "No activity.",
    });
  });

  it("returns signed-out safe payload for blank user", async () => {
    const p = await buildAutonomousAuditUiPayload({ userId: "", generatedAt: "g" });
    expect(p.timeline).toEqual([]);
    expect(p.summaryLine).toMatch(/sign in/i);
    expect(mockListAudit).not.toHaveBeenCalled();
  });

  it("builds timeline, failure breakdown, and top rejected types", async () => {
    mockListAudit.mockResolvedValue([
      auditRow({ id: "x1", actionStatus: "failed", actionType: "retry_publish" }),
      auditRow({ id: "x2", actionStatus: "rejected", actionType: "auto_archive_stale_draft" }),
      auditRow({ id: "x3", actionStatus: "executed", actionType: "retry_publish" }),
    ]);
    mockSummarizeAudit.mockResolvedValue({
      total: 3,
      byStatus: { failed: 1, rejected: 1, executed: 1 },
      executedCount: 1,
      failedCount: 1,
      rejectedCount: 1,
      approvalRequiredCount: 0,
      summaryLine: "3 events.",
    });
    const p = await buildAutonomousAuditUiPayload({ userId: "u1", generatedAt: "g", sinceMs: 0 });
    expect(p.timeline.length).toBeGreaterThan(0);
    expect(p.failureBreakdown.retry_publish).toBe(1);
    expect(p.topRejectedActionTypes.some((t) => t.actionType === "auto_archive_stale_draft")).toBe(true);
    expect(p.recentExecuted.some((e) => e.id === "x3")).toBe(true);
  });
});
