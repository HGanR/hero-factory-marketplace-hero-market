/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import * as Runner from "@/lib/revenue-os/bentley-action-runner";
import * as Pipeline from "@/lib/revenue-os/revenue-os-pipeline-actions";
import {
  runBentleyFullLifecycleAction,
  fetchBentleyLifecycleServerFacts,
} from "@/lib/revenue-os/bentley-full-lifecycle-orchestrator";
import {
  defaultWorkflowState,
  loadWorkflowState,
  resetWorkflowState,
  saveWorkflowState,
  type BentleyWorkflowState,
} from "@/lib/revenue-os/bentley-workflow";
import { computeBentleyAutonomyReadiness } from "@/lib/revenue-os/bentley-autonomy-readiness";

function basePostPipelineWf(): BentleyWorkflowState {
  return {
    ...defaultWorkflowState(),
    currentPhase: "dashboard",
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
    },
    artifacts: {
      campaign: {
        offerStatement: "Offer",
        industry: "Consulting",
        targetAudience: "SMB",
        shortFormHooks: ["h"],
        messagePillars: [],
        longFormOutlines: [],
        objectionReplies: [],
      },
    },
    updatedAt: Date.now(),
  };
}

describe("runBentleyFullLifecycleAction", () => {
  const ctx = () => ({
    userId: "u1",
    clientId: "c1",
    getSnapshot: () => ({
      businessName: "Co",
      platforms: ["TikTok"],
      postingPlatforms: ["tiktok"],
      targetAudience: "All",
      campaignNotes: "x".repeat(50),
      industryKey: "x",
      contentIndustry: "Consulting",
      traffic: 100,
      conversionRate: 1,
      aov: 10,
      coreOffer: "o",
      transformation: "t",
      tone: "Pro",
      contentType: "Post",
      imageStyle: "x",
    }),
    applyPatch: jest.fn(),
  });

  beforeEach(() => {
    resetWorkflowState();
    sessionStorage.clear();
    jest.restoreAllMocks();
    jest.spyOn(Pipeline, "upgradeBentleyCampaignAssetsApi").mockResolvedValue({
      ok: true,
      upgraded: 0,
      skipped: 0,
      failed: 0,
    });
  });

  it("stops at campaign persistence with visible lifecycle error when ensure-campaign fails", async () => {
    const wf = basePostPipelineWf();
    saveWorkflowState(wf);

    jest.spyOn(Runner, "runFullPipelineAction").mockResolvedValue({
      ok: true,
      status: "complete",
      workflow: wf,
      milestones: [],
    } as never);
    jest.spyOn(Pipeline, "ensureCampaignFromBentleyApi").mockRejectedValue(new Error("network down"));
    jest.spyOn(Runner, "runBentleyLaunchFinalizeAction").mockResolvedValue({ ok: true, status: "complete" } as never);

    const r = await runBentleyFullLifecycleAction(ctx(), { serverFacts: { deploymentFeedbackRows: 0 } });

    expect(r.ok).toBe(false);
    expect(r.stoppedAt).toBe("campaign_persisted");
    expect(r.reason).toContain("network down");
    const st = loadWorkflowState();
    expect(st.lifecycle?.campaign_persisted?.status).toBe("blocked");
    expect(st.lifecycle?.campaign_persisted?.detail).toContain("network down");
    expect(st.artifacts.campaignPersistenceError).toContain("network down");
  });

  it("continues through launch when persistence, sync, and finalize succeed", async () => {
    const wf = basePostPipelineWf();
    saveWorkflowState(wf);

    jest.spyOn(Runner, "runFullPipelineAction").mockResolvedValue({
      ok: true,
      status: "complete",
      workflow: wf,
      milestones: [],
    } as never);
    jest.spyOn(Pipeline, "ensureCampaignFromBentleyApi").mockResolvedValue({
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      created: true,
    } as never);
    jest.spyOn(Pipeline, "syncBentleyLaunchApi").mockResolvedValue({
      postIds: ["p1"],
      created: 1,
      skipped: 0,
      rescheduled: 0,
      requireApproval: false,
    } as never);
    jest.spyOn(Runner, "runBentleyLaunchFinalizeAction").mockResolvedValue({ ok: true, status: "complete" } as never);

    const r = await runBentleyFullLifecycleAction(ctx(), {
      serverFacts: { deploymentFeedbackRows: 3, optimizationRunsCount: 0 },
    });

    expect(r.ok).toBe(true);
    expect(r.stoppedAt).toBe("complete");
    const st = loadWorkflowState();
    expect(st.lifecycle?.pipeline_complete?.status).toBe("ok");
    expect(st.lifecycle?.campaign_persisted?.status).toBe("ok");
    expect(st.lifecycle?.launch_synced?.status).toBe("ok");
    expect(st.lifecycle?.launch_finalized?.status).toBe("ok");
    expect(st.lifecycle?.analytics_ready?.status).toBe("ok");
  });

  it("marks analytics waiting when deployment feedback count is zero (honest, not ok)", async () => {
    const wf = basePostPipelineWf();
    wf.artifacts.bentleyDbCampaignId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    wf.artifacts.bentleyLaunchSyncedAt = new Date().toISOString();
    saveWorkflowState(wf);

    jest.spyOn(Runner, "runFullPipelineAction").mockResolvedValue({
      ok: true,
      status: "complete",
      workflow: wf,
      milestones: [],
    } as never);
    jest.spyOn(Pipeline, "ensureCampaignFromBentleyApi").mockResolvedValue({
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      created: false,
    } as never);
    jest.spyOn(Pipeline, "syncBentleyLaunchApi").mockResolvedValue({
      postIds: ["p1"],
      created: 0,
      skipped: 0,
      rescheduled: 0,
      requireApproval: false,
    } as never);
    jest.spyOn(Runner, "runBentleyLaunchFinalizeAction").mockResolvedValue({ ok: true, status: "complete" } as never);

    await runBentleyFullLifecycleAction(ctx(), { serverFacts: { deploymentFeedbackRows: 0 } });
    const st = loadWorkflowState();
    expect(st.lifecycle?.analytics_ready?.status).toBe("waiting");
  });

  it("does not claim optimization_executed ok when recommend_only returns closed gates", async () => {
    const wf = basePostPipelineWf();
    wf.artifacts.bentleyDbCampaignId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    saveWorkflowState(wf);

    jest.spyOn(Runner, "runFullPipelineAction").mockResolvedValue({
      ok: true,
      status: "complete",
      workflow: wf,
      milestones: [],
    } as never);
    jest.spyOn(Pipeline, "ensureCampaignFromBentleyApi").mockResolvedValue({
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      created: false,
    } as never);
    jest.spyOn(Pipeline, "syncBentleyLaunchApi").mockResolvedValue({
      postIds: ["p1"],
      created: 0,
      skipped: 0,
      rescheduled: 0,
      requireApproval: false,
    } as never);
    jest.spyOn(Runner, "runBentleyLaunchFinalizeAction").mockResolvedValue({ ok: true, status: "complete" } as never);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        result: { status: "ready", confidence: "high" },
        execution: {
          gates: { allowed: false, reasons: ["approval_backlog_present"] },
          syncAttempted: false,
        },
      }),
    }) as never;

    await runBentleyFullLifecycleAction(ctx(), {
      serverFacts: { deploymentFeedbackRows: 2 },
      runOptimizationRecommendation: true,
    });

    const st = loadWorkflowState();
    expect(st.lifecycle?.optimization_ready?.status).toBe("blocked");
    expect(st.lifecycle?.optimization_executed?.status).toBe("waiting");
  });
});

describe("computeBentleyAutonomyReadiness lifecycle bands", () => {
  it("reflects blocked launch band when lifecycle shows blocked persistence", () => {
    const wf = defaultWorkflowState();
    wf.lifecycle = {
      pipeline_complete: { status: "ok", detail: "ok" },
      campaign_persisted: { status: "blocked", detail: "ensure failed" },
    };
    const r = computeBentleyAutonomyReadiness({ signedIn: true, workflow: wf });
    expect(r.lifecycleBands.find((b) => b.id === "launch")?.status).toBe("blocked");
    expect(r.lifecycleBands.find((b) => b.id === "full_lifecycle")?.status).toBe("blocked");
  });
});

describe("fetchBentleyLifecycleServerFacts", () => {
  it("returns undefined when fetch fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("off")) as never;
    await expect(fetchBentleyLifecycleServerFacts()).resolves.toBeUndefined();
  });
});
