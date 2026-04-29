/**
 * @jest-environment jsdom
 *
 * `runBentleyLaunchFinalizeAction` — sync API mocked; workflow persisted in sessionStorage.
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { runBentleyLaunchFinalizeAction } from "@/lib/revenue-os/bentley-action-runner";
import {
  defaultWorkflowState,
  loadWorkflowState,
  resetWorkflowState,
  saveWorkflowState,
  type BentleyWorkflowState,
} from "@/lib/revenue-os/bentley-workflow";
import * as PipelineActions from "@/lib/revenue-os/revenue-os-pipeline-actions";

jest.mock("@/lib/revenue-os/bentley-pipeline-stage-sync", () => ({
  reconcileBentleySnapshotFromWorkflow: jest.fn(),
}));

jest.mock("@/lib/revenue-os/revenue-os-pipeline-actions", () => ({
  ...jest.requireActual<typeof import("@/lib/revenue-os/revenue-os-pipeline-actions")>(
    "@/lib/revenue-os/revenue-os-pipeline-actions"
  ),
  syncBentleyLaunchApi: jest.fn(),
}));

const mockSync = jest.mocked(PipelineActions.syncBentleyLaunchApi);

function ctx() {
  return {
    userId: "u1",
    clientId: "c1",
    getSnapshot: () =>
      ({
        industryKey: "x",
        contentIndustry: "X",
        targetAudience: "Y",
        traffic: 1,
        conversionRate: 1,
        aov: 1,
        businessName: "B",
        coreOffer: "O",
        transformation: "T",
        platforms: ["TikTok"],
        postingPlatforms: ["tiktok"],
        tone: "P",
        contentType: "Full Post",
        imageStyle: "cinematic",
        campaignNotes: "x".repeat(140),
      }) as never,
    applyPatch: jest.fn(),
  };
}

describe("runBentleyLaunchFinalizeAction", () => {
  beforeEach(() => {
    resetWorkflowState();
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  it("marks launch_ready complete when sync returns post ids", async () => {
    const cid = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const base: BentleyWorkflowState = {
      ...defaultWorkflowState(),
      artifacts: { ...defaultWorkflowState().artifacts, bentleyDbCampaignId: cid },
      updatedAt: Date.now(),
    };
    saveWorkflowState(base);

    mockSync.mockResolvedValue({
      ok: true,
      created: 1,
      skipped: 0,
      rescheduled: 0,
      postIds: ["post-1"],
      requireApproval: false,
    });

    const r = await runBentleyLaunchFinalizeAction(ctx());
    expect(r.ok).toBe(true);
    const wf = loadWorkflowState();
    expect(wf.completed.launch_ready).toBe(true);
    expect(wf.artifacts.bentleyLaunchSyncedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("fails launch_ready when sync returns no post ids", async () => {
    const cid = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    saveWorkflowState({
      ...defaultWorkflowState(),
      artifacts: { ...defaultWorkflowState().artifacts, bentleyDbCampaignId: cid },
      updatedAt: Date.now(),
    });

    mockSync.mockResolvedValue({
      ok: true,
      created: 0,
      skipped: 0,
      rescheduled: 0,
      postIds: [],
      requireApproval: false,
    });

    const r = await runBentleyLaunchFinalizeAction(ctx());
    expect(r.ok).toBe(false);
    expect(r.status).toBe("failed");
    expect(r.reason).toContain("no campaign posts");
    const wf = loadWorkflowState();
    expect(wf.completed.launch_ready).toBeFalsy();
  });
});
