/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  computePublishApprovalReviewerAnalytics,
  countRecentPublishApprovalsByActorUserId,
  eligibleReviewerUserIdsForPendingPost,
} from "@/lib/revenue-os/publish-approval-reviewer-analytics";
import {
  BENTLEY_UTM_APPROVAL_CHAIN_REQUIRED_ROLE,
  BENTLEY_UTM_APPROVAL_CHAIN_STEP,
  BENTLEY_UTM_APPROVAL_CHAIN_TOTAL,
  BENTLEY_UTM_APPROVAL_STATUS,
  BENTLEY_UTM_APPROVAL_STEP_STARTED_AT,
} from "@/lib/revenue-os/publish-approval-utm";

const CHAIN = {
  steps: [
    { stepIndex: 0, requiredReviewerRole: "editor" as const },
    { stepIndex: 1, requiredReviewerRole: "approver" as const },
  ],
};

describe("eligibleReviewerUserIdsForPendingPost", () => {
  it("legacy pending includes owner and non-reviewer assignees", () => {
    const s = eligibleReviewerUserIdsForPendingPost({
      requiredChainRole: null,
      ownerUserIdNum: 1,
      assignmentRows: [
        { userId: "2", role: "approver" },
        { userId: "3", role: "reviewer" },
      ],
    });
    expect([...s].sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it("owner step only owner user", () => {
    const s = eligibleReviewerUserIdsForPendingPost({
      requiredChainRole: "owner",
      ownerUserIdNum: 9,
      assignmentRows: [{ userId: "2", role: "approver" }],
    });
    expect([...s]).toEqual([9]);
  });

  it("approver step only matching assignees", () => {
    const s = eligibleReviewerUserIdsForPendingPost({
      requiredChainRole: "approver",
      ownerUserIdNum: 9,
      assignmentRows: [
        { userId: "2", role: "approver" },
        { userId: "3", role: "editor" },
      ],
    });
    expect([...s]).toEqual([2]);
  });
});

describe("countRecentPublishApprovalsByActorUserId", () => {
  it("counts decidedByUserId from details", () => {
    const m = countRecentPublishApprovalsByActorUserId(
      [{ details: { decidedByUserId: 5 } }, { details: { decidedByUserId: 5 } }, { details: { decidedByUserId: 7 } }],
      10
    );
    expect(m.get(5)).toBe(2);
    expect(m.get(7)).toBe(1);
  });
});

describe("computePublishApprovalReviewerAnalytics", () => {
  const now = new Date("2026-04-05T12:00:00.000Z");

  it("attributes pending approver-step posts to approver assignee not owner", () => {
    const r = computePublishApprovalReviewerAnalytics({
      posts: [
        {
          id: "p1",
          utmParams: {
            [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval",
            [BENTLEY_UTM_APPROVAL_CHAIN_STEP]: "1",
            [BENTLEY_UTM_APPROVAL_CHAIN_TOTAL]: "2",
            [BENTLEY_UTM_APPROVAL_CHAIN_REQUIRED_ROLE]: "approver",
            [BENTLEY_UTM_APPROVAL_STEP_STARTED_AT]: "2026-04-04T10:00:00.000Z",
          },
        },
      ],
      publishApprovalChain: CHAIN,
      workerRequiresApproval: true,
      ownerUserId: "1",
      assignmentRows: [
        { userId: "2", role: "approver" },
        { userId: "1", role: "owner" },
      ],
      now,
    });
    const approverRow = r.reviewers.find((x) => x.userId === 2);
    const ownerRow = r.reviewers.find((x) => x.userId === 1);
    expect(approverRow?.pendingApprovalCount).toBe(1);
    expect(ownerRow?.pendingApprovalCount).toBe(0);
    expect(r.byRole.approver.totalPending).toBe(1);
    expect(r.byRole.owner.totalPending).toBe(0);
  });

  it("sorts overdue-heavy reviewers first, then oldest wait", () => {
    const r = computePublishApprovalReviewerAnalytics({
      posts: [
        {
          id: "p_ed",
          utmParams: {
            [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval",
            [BENTLEY_UTM_APPROVAL_CHAIN_STEP]: "0",
            [BENTLEY_UTM_APPROVAL_CHAIN_TOTAL]: "2",
            [BENTLEY_UTM_APPROVAL_CHAIN_REQUIRED_ROLE]: "editor",
            [BENTLEY_UTM_APPROVAL_STEP_STARTED_AT]: "2026-04-05T11:00:00.000Z",
          },
        },
        {
          id: "p_ap",
          utmParams: {
            [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval",
            [BENTLEY_UTM_APPROVAL_CHAIN_STEP]: "1",
            [BENTLEY_UTM_APPROVAL_CHAIN_TOTAL]: "2",
            [BENTLEY_UTM_APPROVAL_CHAIN_REQUIRED_ROLE]: "approver",
            [BENTLEY_UTM_APPROVAL_STEP_STARTED_AT]: "2026-04-01T10:00:00.000Z",
          },
        },
      ],
      publishApprovalChain: CHAIN,
      workerRequiresApproval: true,
      ownerUserId: "1",
      assignmentRows: [
        { userId: "6", role: "editor" },
        { userId: "7", role: "approver" },
      ],
      now,
    });
    const idx7 = r.reviewers.findIndex((x) => x.userId === 7);
    const idx6 = r.reviewers.findIndex((x) => x.userId === 6);
    expect(r.reviewers[idx7]!.overdueApprovalCount).toBe(1);
    expect(r.reviewers[idx6]!.overdueApprovalCount).toBe(0);
    expect(idx7).toBeLessThan(idx6);
  });

  it("marks overdue per SLA helper alignment", () => {
    const old = "2020-01-01T00:00:00.000Z";
    const r = computePublishApprovalReviewerAnalytics({
      posts: [
        {
          id: "p1",
          utmParams: {
            [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval",
            [BENTLEY_UTM_APPROVAL_STEP_STARTED_AT]: old,
          },
        },
      ],
      publishApprovalChain: null,
      workerRequiresApproval: true,
      ownerUserId: "10",
      assignmentRows: [],
      now,
    });
    const ownerRow = r.reviewers.find((x) => x.userId === 10);
    expect(ownerRow?.overdueApprovalCount).toBe(1);
    expect(r.byRole.owner.totalOverdue).toBe(1);
  });

  it("attaches recentCompletedCount from audit rows", () => {
    const r = computePublishApprovalReviewerAnalytics({
      posts: [],
      publishApprovalChain: null,
      workerRequiresApproval: true,
      ownerUserId: "5",
      assignmentRows: [{ userId: "5", role: "owner" }],
      recentApprovalAuditRows: [{ details: { decidedByUserId: 5 } }, { details: { decidedByUserId: 5 } }],
      recentApprovalAuditMax: 10,
    });
    expect(r.reviewers.find((x) => x.userId === 5)?.recentCompletedCount).toBe(2);
  });
});
