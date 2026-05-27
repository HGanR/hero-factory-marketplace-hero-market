import {
  buildPublishApprovalSummary,
  isPublishWorkflowBulkApproveSafeRow,
  selectApproveAllTargetsForViewer,
  selectRowsForApproveAllPending,
} from "@/lib/revenue-os/build-publish-approval-summary";
import { buildPublishWorkflowReview } from "@/lib/revenue-os/build-publish-workflow-review";
import { parseCampaignPublishApprovalChainJson } from "@/lib/revenue-os/publish-approval-chain";
import type { RevenueOsSuggestedSchedulePlan } from "@/lib/revenue-os/content-sequence-schedule-types";
import type { RevenueOsBatchCalendarSequence } from "@/lib/revenue-os/content-batch-calendar-sequencing-types";

const schedulePlan: RevenueOsSuggestedSchedulePlan = {
  slots: [
    {
      dayIndex: 2,
      role: "authority",
      suggestedScheduledAt: "2025-06-15T15:00:00.000Z",
      preferredPlatforms: ["Linkedin"],
      confidence: "high",
      reason: "",
    },
    {
      dayIndex: 1,
      role: "attention",
      suggestedScheduledAt: "2025-06-14T10:00:00.000Z",
      preferredPlatforms: ["Instagram"],
      confidence: "high",
      reason: "",
    },
  ],
  timezoneStrategy: "none",
  summary: "",
};

const sequence: RevenueOsBatchCalendarSequence = {
  slots: [
    { dayIndex: 2, role: "authority", preferredPlatforms: ["Linkedin"], confidence: "high", reason: "" },
    { dayIndex: 1, role: "attention", preferredPlatforms: ["Instagram"], confidence: "high", reason: "" },
  ],
  sequencingStrategy: "",
  summary: "",
};

describe("build-publish-workflow-review", () => {
  it("orders rows by scheduled time then sequence day then role priority", () => {
    const summary = buildPublishWorkflowReview({
      posts: [
        {
          id: "b",
          platform: "linkedin",
          status: "DRAFT",
          caption: "B body",
          utmParams: { bentley_content_role: "authority", bentley_sequence_day_index: "2" },
        },
        {
          id: "a",
          platform: "instagram",
          status: "DRAFT",
          caption: "A body",
          utmParams: { bentley_content_role: "attention", bentley_sequence_day_index: "1" },
        },
      ],
      schedulePlan,
      batchCalendarSequence: sequence,
      socialAccounts: [],
    });
    expect(summary.rows.map((r) => r.postId)).toEqual(["a", "b"]);
    expect(summary.sortBasis).toContain("actual_scheduled");
  });

  it("flags missing OAuth for scheduled posts as blocking", () => {
    const summary = buildPublishWorkflowReview({
      posts: [
        {
          id: "x",
          platform: "instagram",
          status: "SCHEDULED",
          scheduledAt: "2025-07-01T12:00:00.000Z",
          caption: "c",
          utmParams: {},
        },
      ],
      socialAccounts: [],
    });
    expect(summary.rows[0]?.hasConflict).toBe(true);
    expect(summary.rows[0]?.conflictSeverity).toBe("blocking");
    expect(summary.readyToConfirm).toBe(false);
  });

  it("flags failed posts as blocking", () => {
    const summary = buildPublishWorkflowReview({
      posts: [
        {
          id: "f",
          platform: "instagram",
          status: "FAILED",
          caption: "x",
          errorMessage: "timeout",
        },
      ],
      socialAccounts: [{ platform: "instagram", platformCanonical: "instagram" }],
    });
    expect(summary.rows[0]?.status).toBe("failed");
    expect(summary.readyToConfirm).toBe(false);
    expect(summary.blockers.some((b) => /failed/i.test(b))).toBe(true);
  });

  it("detects duplicate same-platform same-minute schedules", () => {
    const summary = buildPublishWorkflowReview({
      posts: [
        {
          id: "1",
          platform: "instagram",
          status: "SCHEDULED",
          scheduledAt: "2025-08-01T14:00:15.000Z",
          caption: "a",
        },
        {
          id: "2",
          platform: "instagram",
          status: "SCHEDULED",
          scheduledAt: "2025-08-01T14:00:45.000Z",
          caption: "b",
        },
      ],
      socialAccounts: [{ platform: "instagram", platformCanonical: "instagram" }],
    });
    expect(summary.rows.every((r) => r.hasConflict)).toBe(true);
    expect(summary.readyToConfirm).toBe(false);
  });

  it("readyToConfirm when no blocking conflicts and deployment blockers empty", () => {
    const summary = buildPublishWorkflowReview({
      posts: [
        {
          id: "d",
          platform: "instagram",
          status: "DRAFT",
          caption: "ok " + "x".repeat(50),
          utmParams: {
            bentley_content_role: "attention",
            bentley_suggested_schedule_at: "2025-09-01T12:00:00.000Z",
          },
        },
      ],
      socialAccounts: [{ platform: "instagram", platformCanonical: "instagram" }],
      deploymentReadinessBlockers: [],
    });
    expect(summary.readyToConfirm).toBe(true);
  });

  it("merges deployment readiness blockers", () => {
    const summary = buildPublishWorkflowReview({
      posts: [],
      deploymentReadinessBlockers: ["No OAuth"],
    });
    expect(summary.blockers).toContain("No OAuth");
    expect(summary.readyToConfirm).toBe(false);
  });

  const igAccounts = [{ platform: "instagram", platformCanonical: "instagram" as const }];

  it("with worker approval off, scheduled row is worker-eligible when connected", () => {
    const summary = buildPublishWorkflowReview({
      posts: [
        {
          id: "p-elig",
          platform: "instagram",
          status: "SCHEDULED",
          scheduledAt: "2025-08-01T14:00:00.000Z",
          caption: "ok",
        },
      ],
      socialAccounts: igAccounts,
      workerRequiresApproval: false,
    });
    expect(summary.rows[0]?.approvalStatus).toBe("not_required");
    expect(summary.rows[0]?.eligibleForWorker).toBe(true);
  });

  it("with worker approval on, missing approval metadata is pending and not worker-eligible", () => {
    const summary = buildPublishWorkflowReview({
      posts: [
        {
          id: "p-pend",
          platform: "instagram",
          status: "SCHEDULED",
          scheduledAt: "2025-08-01T14:00:00.000Z",
          caption: "ok",
          utmParams: {},
        },
      ],
      socialAccounts: igAccounts,
      workerRequiresApproval: true,
    });
    expect(summary.rows[0]?.approvalStatus).toBe("pending_approval");
    expect(summary.rows[0]?.eligibleForWorker).toBe(false);
  });

  it("with worker approval on, approved scheduled row becomes worker-eligible", () => {
    const summary = buildPublishWorkflowReview({
      posts: [
        {
          id: "p-ap",
          platform: "instagram",
          status: "SCHEDULED",
          scheduledAt: "2025-08-01T14:00:00.000Z",
          caption: "ok",
          utmParams: { bentley_approval_status: "approved" },
        },
      ],
      socialAccounts: igAccounts,
      workerRequiresApproval: true,
    });
    expect(summary.rows[0]?.approvalStatus).toBe("approved");
    expect(summary.rows[0]?.eligibleForWorker).toBe(true);
  });

  it("maps governance UTM fields onto workflow rows", () => {
    const summary = buildPublishWorkflowReview({
      posts: [
        {
          id: "gov",
          platform: "instagram",
          status: "SCHEDULED",
          scheduledAt: "2025-08-01T14:00:00.000Z",
          caption: "ok",
          utmParams: {
            bentley_approval_status: "approved",
            bentley_approval_by_user_id: "123",
            bentley_approved_by: "Ada",
            bentley_approval_actor_role: "owner",
            bentley_approval_decided_at: "2025-08-01T13:00:00.000Z",
          },
        },
      ],
      socialAccounts: igAccounts,
      workerRequiresApproval: true,
    });
    const r = summary.rows[0];
    expect(r?.hasApprovalIdentity).toBe(true);
    expect(r?.approvalDecidedByUserId).toBe(123);
    expect(r?.approvalDecidedByLabel).toBe("Ada");
    expect(r?.approvalActorRole).toBe("owner");
    expect(r?.eligibleForWorker).toBe(true);
  });

  it("rejected scheduled row is not bulk-approve safe and not worker-eligible", () => {
    const summary = buildPublishWorkflowReview({
      posts: [
        {
          id: "p-rj",
          platform: "instagram",
          status: "SCHEDULED",
          scheduledAt: "2025-08-01T14:00:00.000Z",
          caption: "ok",
          utmParams: { bentley_approval_status: "rejected" },
        },
      ],
      socialAccounts: igAccounts,
      workerRequiresApproval: true,
    });
    expect(isPublishWorkflowBulkApproveSafeRow(summary.rows[0]!)).toBe(false);
    expect(summary.rows[0]?.eligibleForWorker).toBe(false);
  });

  it("bulk approve only targets safe rows; summary counts match statuses", () => {
    const summary = buildPublishWorkflowReview({
      posts: [
        {
          id: "safe",
          platform: "instagram",
          status: "SCHEDULED",
          scheduledAt: "2025-08-01T14:00:00.000Z",
          caption: "a",
          utmParams: { bentley_approval_status: "pending_approval" },
        },
        {
          id: "blocked",
          platform: "linkedin",
          status: "SCHEDULED",
          scheduledAt: "2025-08-01T14:05:00.000Z",
          caption: "b",
          utmParams: { bentley_approval_status: "pending_approval" },
        },
        {
          id: "rej",
          platform: "instagram",
          status: "SCHEDULED",
          scheduledAt: "2025-08-01T15:00:00.000Z",
          caption: "c",
          utmParams: { bentley_approval_status: "rejected" },
        },
      ],
      socialAccounts: igAccounts,
      workerRequiresApproval: true,
    });
    const blocking = summary.rows.find((r) => r.postId === "blocked");
    expect(blocking?.hasConflict).toBe(true);
    expect(blocking?.conflictSeverity).toBe("blocking");
    expect(isPublishWorkflowBulkApproveSafeRow(summary.rows.find((r) => r.postId === "safe")!)).toBe(true);
    expect(isPublishWorkflowBulkApproveSafeRow(blocking!)).toBe(false);
    expect(isPublishWorkflowBulkApproveSafeRow(summary.rows.find((r) => r.postId === "rej")!)).toBe(false);

    const bulkTargets = selectRowsForApproveAllPending(summary.rows);
    expect(bulkTargets.map((r) => r.postId)).toEqual(["safe"]);

    const agg = buildPublishApprovalSummary(summary.rows);
    expect(agg.totalRows).toBe(3);
    expect(agg.pendingApproval).toBe(2);
    expect(agg.rejected).toBe(1);
    expect(agg.approved).toBe(0);
  });
});

describe("selectRowsForApproveAllPending", () => {
  const li = [{ platform: "linkedin", platformCanonical: "linkedin" as const }];

  it("includes only pending_approval among bulk-safe scheduled rows", () => {
    const summary = buildPublishWorkflowReview({
      posts: [
        {
          id: "nr",
          platform: "linkedin",
          status: "SCHEDULED",
          scheduledAt: "2025-08-01T14:00:00.000Z",
          utmParams: { bentley_approval_status: "not_required" },
        },
        {
          id: "pd",
          platform: "linkedin",
          status: "SCHEDULED",
          scheduledAt: "2025-08-01T15:00:00.000Z",
          utmParams: { bentley_approval_status: "pending_approval" },
        },
      ],
      socialAccounts: li,
      workerRequiresApproval: true,
    });
    expect(selectRowsForApproveAllPending(summary.rows).map((r) => r.postId)).toEqual(["pd"]);
  });
});

describe("selectApproveAllTargetsForViewer", () => {
  const li = [{ platform: "linkedin", platformCanonical: "linkedin" as const }];
  const twoStepChain = parseCampaignPublishApprovalChainJson({
    steps: [
      { stepIndex: 0, requiredReviewerRole: "editor" },
      { stepIndex: 1, requiredReviewerRole: "approver" },
    ],
  })!;

  it("returns no targets when viewer cannot finalize approval", () => {
    const summary = buildPublishWorkflowReview({
      posts: [
        {
          id: "pd",
          platform: "linkedin",
          status: "SCHEDULED",
          scheduledAt: "2025-08-01T15:00:00.000Z",
          utmParams: { bentley_approval_status: "pending_approval" },
        },
      ],
      socialAccounts: li,
      workerRequiresApproval: true,
    });
    expect(selectApproveAllTargetsForViewer(summary.rows, false)).toEqual([]);
    expect(selectApproveAllTargetsForViewer(summary.rows, true).map((r) => r.postId)).toEqual(["pd"]);
  });

  it("excludes pending rows when viewer role does not match active chain step", () => {
    const summary = buildPublishWorkflowReview({
      posts: [
        {
          id: "pd",
          platform: "linkedin",
          status: "SCHEDULED",
          scheduledAt: "2025-08-01T15:00:00.000Z",
          utmParams: {
            bentley_approval_status: "pending_approval",
            bentley_approval_chain_step: "0",
            bentley_approval_chain_total: "2",
            bentley_approval_chain_required_role: "editor",
          },
        },
      ],
      socialAccounts: li,
      workerRequiresApproval: true,
      publishApprovalChain: twoStepChain,
    });
    expect(selectApproveAllTargetsForViewer(summary.rows, true, "approver").map((r) => r.postId)).toEqual([]);
    expect(selectApproveAllTargetsForViewer(summary.rows, true, "editor").map((r) => r.postId)).toEqual(["pd"]);
  });
});

describe("buildPublishWorkflowReview approval chain row fields", () => {
  it("exposes current step and required role for pending posts", () => {
    const chain = parseCampaignPublishApprovalChainJson({
      steps: [
        { stepIndex: 0, requiredReviewerRole: "editor" },
        { stepIndex: 1, requiredReviewerRole: "approver" },
      ],
    })!;
    const summary = buildPublishWorkflowReview({
      posts: [
        {
          id: "p1",
          platform: "linkedin",
          status: "SCHEDULED",
          scheduledAt: "2025-08-01T15:00:00.000Z",
          utmParams: {
            bentley_approval_status: "pending_approval",
            bentley_approval_chain_step: "1",
            bentley_approval_chain_total: "2",
            bentley_approval_chain_required_role: "approver",
          },
        },
      ],
      socialAccounts: [{ platform: "linkedin", platformCanonical: "linkedin" }],
      workerRequiresApproval: true,
      publishApprovalChain: chain,
    });
    const r = summary.rows[0]!;
    expect(r.currentApprovalStepIndex).toBe(1);
    expect(r.totalApprovalSteps).toBe(2);
    expect(r.currentApprovalRequiredRole).toBe("approver");
  });

  it("sets approvalStepOverdue when step started before SLA window", () => {
    const chain = parseCampaignPublishApprovalChainJson({
      steps: [
        { stepIndex: 0, requiredReviewerRole: "editor" },
        { stepIndex: 1, requiredReviewerRole: "approver" },
      ],
    })!;
    const slaNow = new Date("2026-03-10T12:00:00.000Z");
    const summary = buildPublishWorkflowReview({
      posts: [
        {
          id: "slow",
          platform: "linkedin",
          status: "SCHEDULED",
          scheduledAt: "2026-02-01T15:00:00.000Z",
          utmParams: {
            bentley_approval_status: "pending_approval",
            bentley_approval_chain_step: "0",
            bentley_approval_chain_total: "2",
            bentley_approval_chain_required_role: "editor",
            bentley_approval_step_started_at: "2026-01-01T00:00:00.000Z",
          },
        },
      ],
      socialAccounts: [{ platform: "linkedin", platformCanonical: "linkedin" }],
      workerRequiresApproval: true,
      publishApprovalChain: chain,
      publishApprovalSlaNow: slaNow,
      publishApprovalSlaDebug: true,
    });
    const r = summary.rows[0]!;
    expect(r.approvalStepOverdue).toBe(true);
    expect(r.approvalStepAgeShortLabel).toBeTruthy();
    expect(r.approvalStepSlaDebug?.logicalAwaitingStepIndex).toBe(0);
  });

  it("does not throw when caption or platform are numeric (session/API JSON)", () => {
    const summary = buildPublishWorkflowReview({
      posts: [
        {
          id: "n",
          platform: 42 as unknown as string,
          status: "SCHEDULED",
          scheduledAt: "2025-07-01T12:00:00.000Z",
          caption: 9001 as unknown as string,
          utmParams: {},
        },
      ],
      socialAccounts: [],
    });
    expect(summary.rows[0]?.bodyPreview).toBe("9001");
    expect(summary.rows[0]?.platform).toBe(42);
  });
});
