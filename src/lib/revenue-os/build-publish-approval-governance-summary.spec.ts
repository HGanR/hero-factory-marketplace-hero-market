import { buildPublishApprovalGovernanceSummary } from "@/lib/revenue-os/build-publish-approval-governance-summary";
import { buildPublishApprovalSummary } from "@/lib/revenue-os/build-publish-approval-summary";
import type { RevenueOsPublishWorkflowRow } from "@/lib/revenue-os/publish-workflow-review-types";

const baseRow = (over: Partial<RevenueOsPublishWorkflowRow>): RevenueOsPublishWorkflowRow => ({
  postId: "p1",
  platform: "instagram",
  title: "",
  bodyPreview: "x",
  status: "scheduled",
  ...over,
});

describe("buildPublishApprovalGovernanceSummary", () => {
  it("counts approver identities and pending review", () => {
    const rows: RevenueOsPublishWorkflowRow[] = [
      baseRow({
        approvalStatus: "pending_approval",
        approvalDecidedByUserId: null,
      }),
      baseRow({
        postId: "p2",
        approvalStatus: "approved",
        approvalDecidedByUserId: 99,
        approvalDecidedByLabel: "Ada",
      }),
      baseRow({
        postId: "p3",
        approvalStatus: "rejected",
        approvalDecidedByUserId: 99,
        approvalDecidedByLabel: "Ada",
      }),
    ];
    const g = buildPublishApprovalGovernanceSummary(rows, true);
    expect(g.pendingCount).toBe(1);
    expect(g.approvedCount).toBe(1);
    expect(g.rejectedCount).toBe(1);
    expect(g.rowsWithDeciderUserId).toBe(2);
    expect(g.approverIdentitiesPresent).toBe(true);
    expect(g.requiresHumanApproval).toBe(true);
  });
});

describe("buildPublishApprovalSummary governance fields", () => {
  it("includes approverIdentitiesPresent and per-status identity counts", () => {
    const rows: RevenueOsPublishWorkflowRow[] = [
      baseRow({
        approvalStatus: "approved",
        approvalDecidedByUserId: 1,
        eligibleForWorker: true,
      }),
      baseRow({
        postId: "p2",
        approvalStatus: "approved",
        approvalDecidedByUserId: null,
        eligibleForWorker: true,
      }),
    ];
    const agg = buildPublishApprovalSummary(rows);
    expect(agg.approverIdentitiesPresent).toBe(true);
    expect(agg.rowsWithDeciderUserId).toBe(1);
    expect(agg.approvedWithDeciderIdentity).toBe(1);
    expect(agg.rejectedWithDeciderIdentity).toBe(0);
  });
});
