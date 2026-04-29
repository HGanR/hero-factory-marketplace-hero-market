import {
  formatBentleyDeploymentFeedbackReply,
  isDeploymentFeedbackIntent,
} from "@/lib/revenue-os/bentley-deployment-feedback-chat";
import { summarizeDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-summary";
import { normalizePublishOutcomeToFeedback } from "@/lib/revenue-os/deployment-feedback-contract";

describe("bentley-deployment-feedback-chat", () => {
  it("isDeploymentFeedbackIntent matches common questions", () => {
    expect(isDeploymentFeedbackIntent("What is working?")).toBe(true);
    expect(isDeploymentFeedbackIntent("How did my campaign do")).toBe(true);
    expect(isDeploymentFeedbackIntent("What platform is performing best?")).toBe(true);
    expect(isDeploymentFeedbackIntent("random")).toBe(false);
  });

  it("format reply when only publish-state exists (no fabricated metrics)", () => {
    const rows = [
      normalizePublishOutcomeToFeedback({
        campaignPostId: "p",
        campaignId: "c",
        platform: "linkedin",
        outcome: "published",
        source: "publish_worker",
      }),
    ];
    const rollup = summarizeDeploymentFeedback(rows);
    const text = formatBentleyDeploymentFeedbackReply({
      rollup,
      latest: rows[0] ?? null,
      rowCount: 1,
    });
    expect(text).toMatch(/Published \(recorded\)/);
    expect(text).toMatch(/Channel metrics|not in the database|platform performance sync/i);
    expect(text).not.toMatch(/1000 impressions/);
  });

  it("names both measured channels when metric sync context lists Instagram and LinkedIn", () => {
    const rows = [
      normalizePublishOutcomeToFeedback({
        campaignPostId: "p",
        campaignId: "c",
        platform: "instagram",
        outcome: "published",
        source: "publish_worker",
      }),
    ];
    const rollup = summarizeDeploymentFeedback(rows);
    const text = formatBentleyDeploymentFeedbackReply({
      rollup,
      latest: rows[0] ?? null,
      rowCount: 1,
      metricSyncContext: {
        liveMetricPlatforms: ["instagram", "linkedin"],
        stubPublishPlatforms: ["x"],
      },
    });
    expect(text).toMatch(/Instagram/);
    expect(text).toMatch(/LinkedIn/);
    expect(text).toMatch(/likes\/comments|impressions/i);
  });
});
