import { describe, expect, it } from "@jest/globals";
import { computeCampaignGovernanceHealth } from "@/lib/revenue-os/campaign-governance-health";
import type { RevenueOsPublishWorkflowRow } from "@/lib/revenue-os/publish-workflow-review-types";

const emptyCounts = { approver: 0, editor: 0, reviewer: 0 };

function row(partial: Partial<RevenueOsPublishWorkflowRow>): RevenueOsPublishWorkflowRow {
  return {
    postId: "p1",
    platform: "linkedin",
    bodyPreview: "",
    status: "scheduled",
    ...partial,
  };
}

describe("computeCampaignGovernanceHealth", () => {
  it("summarizes approval off and reviewer counts", () => {
    const { summary, warnings } = computeCampaignGovernanceHealth({
      effectiveApprovalRequired: false,
      publishApprovalChain: null,
      reviewerRoleCounts: { approver: 2, editor: 1, reviewer: 3 },
      rows: [],
      reportSchedule: null,
    });
    expect(summary.approvalRequiredLabel).toBe("Off");
    expect(summary.chainLabel).toContain("not required");
    expect(summary.reportDeliveryLabel).toBe("Not configured");
    expect(summary.reviewerCountsLine).toContain("approver 2");
    expect(warnings).toHaveLength(0);
  });

  it("warns when chain needs approver but none assigned", () => {
    const chain = {
      steps: [
        { stepIndex: 0, requiredReviewerRole: "approver" as const },
        { stepIndex: 1, requiredReviewerRole: "owner" as const },
      ],
    };
    const { warnings } = computeCampaignGovernanceHealth({
      effectiveApprovalRequired: true,
      publishApprovalChain: chain,
      reviewerRoleCounts: emptyCounts,
      rows: [],
      reportSchedule: null,
    });
    expect(warnings.some((w) => w.code === "CHAIN_STEP_NO_ASSIGNEE")).toBe(true);
  });

  it("warns for scheduled reports owner_and_admins with no assignments", () => {
    const { warnings } = computeCampaignGovernanceHealth({
      effectiveApprovalRequired: false,
      publishApprovalChain: null,
      reviewerRoleCounts: emptyCounts,
      rows: [],
      reportSchedule: {
        enabled: true,
        frequency: "weekly",
        format: "csv",
        recipientMode: "owner_and_admins",
      },
    });
    expect(warnings.some((w) => w.code === "REPORT_NO_EXTRA_RECIPIENTS")).toBe(true);
  });

  it("warns when pending row needs editor but only reviewers assigned", () => {
    const { warnings } = computeCampaignGovernanceHealth({
      effectiveApprovalRequired: true,
      publishApprovalChain: null,
      reviewerRoleCounts: { approver: 0, editor: 0, reviewer: 2 },
      rows: [
        row({
          approvalStatus: "pending_approval",
          currentApprovalRequiredRole: "editor",
        }),
      ],
      reportSchedule: null,
    });
    expect(warnings.some((w) => w.code === "PENDING_NO_STEP_ASSIGNEE")).toBe(true);
  });

  it("labels multi-step chain in summary", () => {
    const chain = {
      steps: [
        { stepIndex: 0, requiredReviewerRole: "editor" as const },
        { stepIndex: 1, requiredReviewerRole: "approver" as const },
      ],
    };
    const { summary } = computeCampaignGovernanceHealth({
      effectiveApprovalRequired: true,
      publishApprovalChain: chain,
      reviewerRoleCounts: { approver: 1, editor: 1, reviewer: 0 },
      rows: [],
      reportSchedule: null,
    });
    expect(summary.chainLabel).toContain("2-step");
  });
});
