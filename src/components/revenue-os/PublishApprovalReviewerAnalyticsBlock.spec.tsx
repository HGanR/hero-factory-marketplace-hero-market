/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import { PublishApprovalReviewerAnalyticsBlock } from "./PublishApprovalReviewerAnalyticsBlock";

describe("PublishApprovalReviewerAnalyticsBlock", () => {
  it("renders reviewer rows and by-role line", () => {
    const h = renderToStaticMarkup(
      <PublishApprovalReviewerAnalyticsBlock
        data={{
          reviewers: [
            {
              userId: 12,
              reviewerRole: "approver",
              pendingApprovalCount: 2,
              overdueApprovalCount: 1,
              averagePendingStepAgeMs: 3600000,
              oldestPendingStepAgeMs: 7200000,
              assignedCampaignCount: 1,
              recentCompletedCount: 3,
            },
          ],
          byRole: {
            editor: { totalPending: 0, totalOverdue: 0, averagePendingStepAgeMs: null },
            approver: { totalPending: 2, totalOverdue: 1, averagePendingStepAgeMs: 3600000 },
            owner: { totalPending: 0, totalOverdue: 0, averagePendingStepAgeMs: null },
          },
        }}
      />
    );
    expect(h).toContain("publish-approval-reviewer-analytics");
    expect(h).toContain("#12");
    expect(h).toContain("approver");
    expect(h).toContain("done 3");
    expect(h).toContain("By role");
    expect(h).not.toContain("&quot;byRole&quot;");
  });

  it("shows raw JSON in debug mode", () => {
    const data = {
      reviewers: [],
      byRole: {
        editor: { totalPending: 0, totalOverdue: 0, averagePendingStepAgeMs: null },
        approver: { totalPending: 0, totalOverdue: 0, averagePendingStepAgeMs: null },
        owner: { totalPending: 0, totalOverdue: 0, averagePendingStepAgeMs: null },
      },
    };
    const h = renderToStaticMarkup(<PublishApprovalReviewerAnalyticsBlock data={data} debug />);
    expect(h).toContain("&quot;reviewers&quot;");
  });
});
