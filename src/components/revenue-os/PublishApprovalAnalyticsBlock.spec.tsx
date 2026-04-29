/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import { PublishApprovalAnalyticsBlock } from "./PublishApprovalAnalyticsBlock";

describe("PublishApprovalAnalyticsBlock", () => {
  it("renders compact summary and role/step breakdown", () => {
    const h = renderToStaticMarkup(
      <PublishApprovalAnalyticsBlock
        summary={{
          pendingApprovalCount: 3,
          overdueApprovalCount: 1,
          averagePendingStepAgeMs: 5 * 3600000,
          oldestPendingStepAgeMs: 10 * 3600000,
          byRole: { editor: 2, approver: 1 },
          byStepIndex: { "0": 2, "1": 1 },
        }}
        stalledPosts={[
          {
            postId: "post-aaaa-bbbb-cccc-dddd-eeee",
            approvalStatus: "pending_approval",
            currentApprovalStepIndex: 0,
            totalApprovalSteps: 2,
            currentApprovalRequiredRole: "editor",
            approvalStepAgeMs: 72 * 3600000,
            approvalStepAgeShortLabel: "3d",
            approvalStepOverdue: true,
          },
        ]}
      />
    );
    expect(h).toContain("publish-approval-analytics");
    expect(h).toContain("Pending:");
    expect(h).toContain(">3</span>");
    expect(h).toContain("Overdue:");
    expect(h).toContain(">1</span>");
    expect(h).toContain("Oldest wait:");
    expect(h).toContain("10h");
    expect(h).toContain("Avg wait:");
    expect(h).toContain("5h");
    expect(h).toContain("editor:2");
    expect(h).toContain("s1:2");
    expect(h).toContain("Most stalled");
    expect(h).toContain("post-aaa");
    expect(h).toContain("overdue");
  });

  it("includes raw JSON when debug is true", () => {
    const summary = {
      pendingApprovalCount: 0,
      overdueApprovalCount: 0,
      averagePendingStepAgeMs: null,
      oldestPendingStepAgeMs: null,
      byRole: {},
      byStepIndex: {},
    };
    const h = renderToStaticMarkup(
      <PublishApprovalAnalyticsBlock summary={summary} stalledPosts={[]} debug />
    );
    expect(h).toContain("&quot;pendingApprovalCount&quot;: 0");
  });
});
