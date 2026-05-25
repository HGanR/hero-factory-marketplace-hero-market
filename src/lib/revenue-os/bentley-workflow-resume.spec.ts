/** @jest-environment jsdom */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { resumeDashboardPipelineWithLifecycle, resumePipeline } from "@/lib/revenue-os/bentley-pipeline-resume";
import * as BentleyActionRunner from "@/lib/revenue-os/bentley-action-runner";
import type { BentleyActionRunnerContext } from "@/lib/revenue-os/bentley-action-runner";
import { bentleyContinuityLog } from "@/lib/revenue-os/bentley-continuity-log";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import {
  defaultWorkflowState,
  getFirstIncompleteWorkflowPhase,
  markPhaseComplete,
  type BentleyWorkflowPhaseId,
  type BentleyWorkflowState,
} from "@/lib/revenue-os/bentley-workflow";

jest.mock("@/lib/revenue-os/bentley-continuity-log", () => ({
  bentleyContinuityLog: jest.fn(),
}));

function minimalSnapshot(over: Partial<BentleySnapshot> = {}): BentleySnapshot {
  return {
    industryKey: "consulting",
    contentIndustry: "Consulting",
    targetAudience: "SMB",
    traffic: 1000,
    conversionRate: 1,
    aov: 100,
    businessName: "Acme Resume",
    coreOffer: "Offer",
    transformation: "Growth",
    platforms: [],
    postingPlatforms: ["tiktok"],
    tone: "Pro",
    contentType: "Post",
    imageStyle: "clean",
    campaignNotes: "",
    ...over,
  };
}

describe("getFirstIncompleteWorkflowPhase (resume / stage order)", () => {
  it("returns the first phase in PHASE_ORDER that is not completed", () => {
    let s = defaultWorkflowState();
    expect(getFirstIncompleteWorkflowPhase(s)).toBe("intake");
    s = markPhaseComplete(s, "intake");
    expect(getFirstIncompleteWorkflowPhase(s)).toBe("research");
  });

  it("returns dashboard when pipeline steps through analysis are complete but dashboard is not", () => {
    const order: BentleyWorkflowPhaseId[] = [
      "intake",
      "research",
      "trends",
      "market_sweep",
      "content",
      "campaign_notes",
      "campaign_generation",
      "media_brief",
      "analysis",
    ];
    let s: BentleyWorkflowState = defaultWorkflowState();
    for (const p of order) {
      s = markPhaseComplete(s, p);
    }
    expect(getFirstIncompleteWorkflowPhase(s)).toBe("dashboard");
  });

  it("returns null when every ordered phase including dashboard and launch_ready is complete", () => {
    const order: BentleyWorkflowPhaseId[] = [
      "intake",
      "research",
      "trends",
      "market_sweep",
      "content",
      "campaign_notes",
      "campaign_generation",
      "media_brief",
      "analysis",
      "dashboard",
      "launch_ready",
    ];
    let s: BentleyWorkflowState = defaultWorkflowState();
    for (const p of order) {
      s = markPhaseComplete(s, p);
    }
    expect(getFirstIncompleteWorkflowPhase(s)).toBeNull();
  });
});

describe("resumePipeline", () => {
  const runFullPipeline = jest.fn();
  let createSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    runFullPipeline.mockResolvedValue({
      ok: true,
      status: "complete",
      milestones: [],
    });
    createSpy = jest.spyOn(BentleyActionRunner, "createBentleyActionRunner").mockReturnValue({
      runFullPipeline,
    } as unknown as ReturnType<typeof BentleyActionRunner.createBentleyActionRunner>);
  });

  afterEach(() => {
    createSpy.mockRestore();
  });

  it("logs pipeline_resume, builds a runner from context, and delegates to runFullPipeline", async () => {
    const ctx: BentleyActionRunnerContext = {
      userId: "u1",
      clientId: "c1",
      getSnapshot: () => minimalSnapshot({ businessName: "Acme Resume" }),
      applyPatch: jest.fn(),
    };

    await resumePipeline(ctx);

    expect(bentleyContinuityLog).toHaveBeenCalledWith("pipeline_resume", {
      businessName: "Acme Resume",
    });
    expect(BentleyActionRunner.createBentleyActionRunner).toHaveBeenCalledWith(ctx);
    expect(runFullPipeline).toHaveBeenCalledTimes(1);
  });
});

describe("resumeDashboardPipelineWithLifecycle", () => {
  const runFullLifecycle = jest.fn();
  let createSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    runFullLifecycle.mockResolvedValue({ ok: true, stoppedAt: "complete" as const, workflow: defaultWorkflowState() });
    createSpy = jest.spyOn(BentleyActionRunner, "createBentleyActionRunner").mockReturnValue({
      runFullLifecycle,
    } as unknown as ReturnType<typeof BentleyActionRunner.createBentleyActionRunner>);
  });

  afterEach(() => {
    createSpy.mockRestore();
  });

  it("delegates to runFullLifecycle", async () => {
    const ctx: BentleyActionRunnerContext = {
      userId: "u1",
      clientId: "c1",
      getSnapshot: () => minimalSnapshot(),
      applyPatch: jest.fn(),
    };
    const r = await resumeDashboardPipelineWithLifecycle(ctx);
    expect(r.ok).toBe(true);
    expect(runFullLifecycle).toHaveBeenCalledTimes(1);
  });
});
