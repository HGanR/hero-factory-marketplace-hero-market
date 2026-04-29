import {
  formatBentleyApprovalWorkerAnalyticsReply,
  isApprovalWorkerAnalyticsIntent,
} from "@/lib/revenue-os/bentley-approval-worker-analytics-chat";
import type { ScheduledQueueSummaryJson } from "@/lib/revenue-os/bentley-scheduled-publish-chat";

const baseQ = (): ScheduledQueueSummaryJson => ({
  scheduledCount: 0,
  retryScheduledCount: 0,
  publishingCount: 0,
  failedCount: 0,
  postedCount: 0,
  nextDue: null,
  recentFailures: [],
  recentPublishedWindowHours: 48,
  approvalWorker: {
    effectiveApprovalRequired: true,
    summary: {
      totalScheduled: 1,
      awaitingApproval: 1,
      approvedAndEligible: 0,
      rejected: 0,
      skippedByApproval: 0,
      dueNowButBlockedByApproval: 1,
      publishingNow: 0,
      recentlyPublished: 0,
      failedOperationally: 0,
      retryScheduled: 0,
    },
    insight: {
      primaryBottleneck: "approval_waiting",
      summaryText: "Test summary.",
      recommendation: "Do the thing.",
    },
  },
});

describe("bentley-approval-worker-analytics-chat", () => {
  it("detects analytics intents", () => {
    expect(isApprovalWorkerAnalyticsIntent("what is waiting on approval")).toBe(true);
    expect(isApprovalWorkerAnalyticsIntent("is the worker waiting on me")).toBe(true);
    expect(isApprovalWorkerAnalyticsIntent("hello")).toBe(false);
  });

  it("formats reply with counts", () => {
    const t = formatBentleyApprovalWorkerAnalyticsReply({ q: baseQ() });
    expect(t).toMatch(/Awaiting approval/);
    expect(t).toMatch(/Due now but blocked by approval/);
    expect(t).toMatch(/approval_waiting/);
  });

  it("handles missing approvalWorker", () => {
    const q = { ...baseQ(), approvalWorker: undefined };
    expect(formatBentleyApprovalWorkerAnalyticsReply({ q })).toMatch(/couldn’t load/i);
  });
});
