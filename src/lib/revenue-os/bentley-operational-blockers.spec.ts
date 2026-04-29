import { describe, it, expect } from "@jest/globals";
import {
  BENTLEY_ANALYTICS_FEEDBACK_GRACE_HOURS,
  evaluateBentleyOperationalIssues,
} from "@/lib/revenue-os/bentley-operational-blockers";
import { BENTLEY_UTM_APPROVAL_STATUS } from "@/lib/revenue-os/publish-approval-utm";

describe("evaluateBentleyOperationalIssues", () => {
  it("flags launch_blocked_missing_social_account when platform not connected", () => {
    const { codes } = evaluateBentleyOperationalIssues({
      posts: [
        {
          platform: "tiktok",
          status: "SCHEDULED",
          scheduledAt: new Date().toISOString(),
          socialAccountId: null,
          utmParams: {},
          errorMessage: null,
        },
      ],
      socialPlatformsConnected: ["linkedin"],
      ambiguousSocialPlatforms: [],
      workerRequiresApproval: false,
      deploymentFeedbackRows: 0,
      publishedPostCount: 0,
      earliestPostedAtIso: null,
      launchSyncedInSession: false,
    });
    expect(codes).toContain("launch_blocked_missing_social_account");
    expect(codes).toContain("scheduled_but_worker_ineligible");
  });

  it("flags launch_blocked_provider_unresolved when multiple accounts per platform and post unpinned", () => {
    const { codes } = evaluateBentleyOperationalIssues({
      posts: [
        {
          platform: "linkedin",
          status: "SCHEDULED",
          scheduledAt: new Date().toISOString(),
          socialAccountId: null,
          utmParams: {},
          errorMessage: null,
        },
      ],
      socialPlatformsConnected: ["linkedin"],
      ambiguousSocialPlatforms: ["linkedin"],
      workerRequiresApproval: false,
      deploymentFeedbackRows: 0,
      publishedPostCount: 0,
      earliestPostedAtIso: null,
      launchSyncedInSession: false,
    });
    expect(codes).toContain("launch_blocked_provider_unresolved");
  });

  it("flags approval_pending_blocks_publish when UTM pending and worker requires approval", () => {
    const { codes } = evaluateBentleyOperationalIssues({
      posts: [
        {
          platform: "linkedin",
          status: "SCHEDULED",
          scheduledAt: new Date().toISOString(),
          socialAccountId: "acc-1",
          utmParams: { [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval" },
          errorMessage: null,
        },
      ],
      socialPlatformsConnected: ["linkedin"],
      ambiguousSocialPlatforms: [],
      workerRequiresApproval: true,
      deploymentFeedbackRows: 0,
      publishedPostCount: 0,
      earliestPostedAtIso: null,
      launchSyncedInSession: false,
    });
    expect(codes).toContain("approval_pending_blocks_publish");
  });

  it("uses analytics_waiting_initial_window before grace elapses with zero feedback", () => {
    const posted = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const { analyticsDetail } = evaluateBentleyOperationalIssues({
      posts: [],
      socialPlatformsConnected: [],
      ambiguousSocialPlatforms: [],
      workerRequiresApproval: false,
      deploymentFeedbackRows: 0,
      publishedPostCount: 1,
      earliestPostedAtIso: posted,
      launchSyncedInSession: false,
      nowMs: Date.now(),
    });
    expect(analyticsDetail.reasonCode).toBe("analytics_waiting_initial_window");
    expect(analyticsDetail.status).toBe("waiting");
  });

  it("escalates to analytics_blocked after grace window with no feedback", () => {
    const posted = new Date(Date.now() - (BENTLEY_ANALYTICS_FEEDBACK_GRACE_HOURS + 4) * 3600 * 1000).toISOString();
    const { analyticsDetail, codes } = evaluateBentleyOperationalIssues({
      posts: [],
      socialPlatformsConnected: [],
      ambiguousSocialPlatforms: [],
      workerRequiresApproval: false,
      deploymentFeedbackRows: 0,
      publishedPostCount: 1,
      earliestPostedAtIso: posted,
      launchSyncedInSession: false,
      nowMs: Date.now(),
    });
    expect(analyticsDetail.status).toBe("blocked");
    expect(codes).toContain("analytics_blocked_no_feedback_after_expected_window");
  });
});
