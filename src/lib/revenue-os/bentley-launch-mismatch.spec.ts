import { describe, it, expect } from "@jest/globals";
import { detectBentleyLaunchMismatches } from "@/lib/revenue-os/bentley-launch-mismatch";
import { defaultWorkflowState } from "@/lib/revenue-os/bentley-workflow";

describe("detectBentleyLaunchMismatches", () => {
  it("flags db campaign without sync timestamp", () => {
    const s = {
      ...defaultWorkflowState(),
      artifacts: { ...defaultWorkflowState().artifacts, bentleyDbCampaignId: "camp-1" },
      completed: { campaign_generation: true },
    };
    expect(detectBentleyLaunchMismatches(s)).toContain("workflow_has_db_campaign_but_no_launch_sync_timestamp");
  });

  it("no db_campaign_but_no_launch when sync timestamp exists", () => {
    const s = {
      ...defaultWorkflowState(),
      artifacts: {
        ...defaultWorkflowState().artifacts,
        bentleyDbCampaignId: "camp-1",
        bentleyLaunchSyncedAt: "2024-01-01T00:00:00.000Z",
      },
    };
    expect(detectBentleyLaunchMismatches(s).some((x) => x.includes("db_campaign_but_no_launch"))).toBe(
      false
    );
  });

  it("flags db campaign with zero posts when caller passes campaignPostCount", () => {
    const base = defaultWorkflowState();
    const s = {
      ...base,
      artifacts: { ...base.artifacts, bentleyDbCampaignId: "c1" },
    };
    expect(detectBentleyLaunchMismatches(s, { campaignPostCount: 0 })).toContain(
      "workflow_has_db_campaign_but_no_posts"
    );
  });

  it("flags launch finalize blocked when lastError indicates empty post ids", () => {
    const base = defaultWorkflowState();
    const s = {
      ...base,
      lastError: "Launch sync returned no campaign posts — cannot complete launch_ready.",
    };
    expect(detectBentleyLaunchMismatches(s)).toContain("launch_finalize_blocked_empty_post_ids");
  });

  it("does not flag zero posts when campaignPostCount is omitted", () => {
    const base = defaultWorkflowState();
    const s = {
      ...base,
      artifacts: { ...base.artifacts, bentleyDbCampaignId: "c1" },
    };
    expect(detectBentleyLaunchMismatches(s).some((x) => x.includes("no_posts"))).toBe(false);
  });

  it("flags sync recorded but launch_ready still next phase", () => {
    const base = defaultWorkflowState();
    const s = {
      ...base,
      artifacts: {
        ...base.artifacts,
        bentleyDbCampaignId: "c1",
        bentleyLaunchSyncedAt: "2024-01-01T00:00:00.000Z",
      },
      completed: {
        intake: true,
        research: true,
        trends: true,
        market_sweep: true,
        content: true,
        campaign_notes: true,
        campaign_generation: true,
        media_brief: true,
        analysis: true,
        dashboard: true,
      },
    };
    expect(detectBentleyLaunchMismatches(s)).toContain("launch_sync_recorded_but_launch_ready_still_incomplete");
  });
});
