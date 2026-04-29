import { approvalAuditEventsAfterRefresh } from "@/lib/revenue-os/debug-approval-audit-state";
import type { PublishApprovalAuditRecentApiEvent } from "@/lib/revenue-os/publish-approval-audit";

describe("approvalAuditEventsAfterRefresh", () => {
  const sample: PublishApprovalAuditRecentApiEvent[] = [
    {
      id: "a",
      postId: "p1",
      action: "publish_approval_approved",
      platform: "linkedin",
      details: {},
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  it("returns empty when debug is false (clears UI state)", () => {
    expect(approvalAuditEventsAfterRefresh(false, sample)).toEqual([]);
    expect(approvalAuditEventsAfterRefresh(false, undefined)).toEqual([]);
  });

  it("returns fetched array when debug is true (panel refetch can populate)", () => {
    expect(approvalAuditEventsAfterRefresh(true, sample)).toEqual(sample);
  });

  it("returns empty when debug is true but payload is not an array", () => {
    expect(approvalAuditEventsAfterRefresh(true, null)).toEqual([]);
    expect(approvalAuditEventsAfterRefresh(true, undefined)).toEqual([]);
  });
});
