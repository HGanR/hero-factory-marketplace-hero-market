import { buildApprovalWorkerAnalytics } from "@/lib/revenue-os/build-approval-worker-analytics";

const NOW = new Date("2026-06-01T12:00:00.000Z");
const IG = [{ platform: "instagram", platformCanonical: "instagram" as const }];

describe("buildApprovalWorkerAnalytics", () => {
  it("primary bottleneck: approval waiting when due posts are blocked by approval", () => {
    const { summary, insight } = buildApprovalWorkerAnalytics({
      posts: [
        {
          id: "p1",
          platform: "instagram",
          status: "SCHEDULED",
          scheduledAt: "2026-06-01T11:00:00.000Z",
          utmParams: { bentley_approval_status: "pending_approval" },
        },
      ],
      now: NOW,
      workerRequiresApproval: true,
      socialAccounts: IG,
    });
    expect(summary.dueNowButBlockedByApproval).toBe(1);
    expect(summary.awaitingApproval).toBe(1);
    expect(summary.approvedAndEligible).toBe(0);
    expect(insight.primaryBottleneck).toBe("approval_waiting");
  });

  it("primary bottleneck: operational failure when failures dominate and nothing else is due", () => {
    const { summary, insight } = buildApprovalWorkerAnalytics({
      posts: [
        {
          id: "f1",
          platform: "instagram",
          status: "FAILED",
          utmParams: {},
          errorMessage: "timeout",
        },
      ],
      now: NOW,
      workerRequiresApproval: true,
      socialAccounts: IG,
    });
    expect(summary.failedOperationally).toBe(1);
    expect(insight.primaryBottleneck).toBe("operational_failure");
  });

  it("mixed when both due approval-blocked and due eligible exist", () => {
    const { insight } = buildApprovalWorkerAnalytics({
      posts: [
        {
          id: "a",
          platform: "instagram",
          status: "SCHEDULED",
          scheduledAt: "2026-06-01T11:00:00.000Z",
          utmParams: { bentley_approval_status: "pending_approval" },
        },
        {
          id: "b",
          platform: "instagram",
          status: "SCHEDULED",
          scheduledAt: "2026-06-01T11:30:00.000Z",
          utmParams: { bentley_approval_status: "approved" },
        },
      ],
      now: NOW,
      workerRequiresApproval: true,
      socialAccounts: IG,
    });
    expect(insight.primaryBottleneck).toBe("mixed");
  });

  it("no due posts: idle queue", () => {
    const { summary, insight } = buildApprovalWorkerAnalytics({
      posts: [
        {
          id: "future",
          platform: "instagram",
          status: "SCHEDULED",
          scheduledAt: "2026-06-02T12:00:00.000Z",
          utmParams: { bentley_approval_status: "approved" },
        },
      ],
      now: NOW,
      workerRequiresApproval: true,
      socialAccounts: IG,
    });
    expect(summary.dueNowButBlockedByApproval).toBe(0);
    expect(insight.primaryBottleneck).toBe("no_due_posts");
  });

  it("approved scheduled rows count as worker-eligible when connected", () => {
    const { summary } = buildApprovalWorkerAnalytics({
      posts: [
        {
          id: "ok",
          platform: "instagram",
          status: "SCHEDULED",
          scheduledAt: "2026-06-02T12:00:00.000Z",
          utmParams: { bentley_approval_status: "approved" },
        },
      ],
      now: NOW,
      workerRequiresApproval: true,
      socialAccounts: IG,
    });
    expect(summary.approvedAndEligible).toBe(1);
  });

  it("rejected rows are not eligible", () => {
    const { summary } = buildApprovalWorkerAnalytics({
      posts: [
        {
          id: "r",
          platform: "instagram",
          status: "SCHEDULED",
          scheduledAt: "2026-06-01T11:00:00.000Z",
          utmParams: { bentley_approval_status: "rejected" },
        },
      ],
      now: NOW,
      workerRequiresApproval: true,
      socialAccounts: IG,
    });
    expect(summary.rejected).toBe(1);
    expect(summary.approvedAndEligible).toBe(0);
    expect(summary.dueNowButBlockedByApproval).toBe(1);
  });

  it("passes through skippedByApproval from last worker run snapshot", () => {
    const { summary } = buildApprovalWorkerAnalytics({
      posts: [],
      now: NOW,
      workerRequiresApproval: true,
      lastWorkerRun: { skippedAwaitingApproval: 3 },
    });
    expect(summary.skippedByApproval).toBe(3);
  });
});
