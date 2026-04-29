/**
 * @jest-environment jsdom
 *
 * Focused execution tests for `runFullPipelineAction` (skip semantics, lock, failure preservation).
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import {
  defaultWorkflowState,
  loadWorkflowState,
  resetWorkflowState,
  saveWorkflowState,
  type BentleyWorkflowState,
} from "@/lib/revenue-os/bentley-workflow";
import { runResearch } from "@/lib/revenue-os/run-research";
import { runTrends } from "@/lib/revenue-os/run-trends";
import * as RunLock from "@/lib/revenue-os/bentley-run-lock";
import * as PipelineSync from "@/lib/revenue-os/bentley-pipeline-stage-sync";
import { runFullPipelineAction } from "@/lib/revenue-os/bentley-action-runner";

jest.mock("@/lib/revenue-os/bentley-run-observability", () => ({
  ...jest.requireActual<typeof import("@/lib/revenue-os/bentley-run-observability")>(
    "@/lib/revenue-os/bentley-run-observability"
  ),
  startBentleyOrchestrationRun: jest.fn(),
  endBentleyOrchestrationRun: jest.fn(),
  getBentleyActiveRunId: jest.fn(() => null),
  recordBentleyRunBlockedByLock: jest.fn(),
  recordBentleyRunBlockedIntake: jest.fn(),
  computeResumedFromWorkflow: jest.fn(() => false),
  syncBentleyRunFromPipelineDetail: jest.fn(),
}));

jest.mock("@/lib/revenue-os/bentley-pipeline-stage-sync", () => ({
  ...jest.requireActual<typeof import("@/lib/revenue-os/bentley-pipeline-stage-sync")>(
    "@/lib/revenue-os/bentley-pipeline-stage-sync"
  ),
  reconcileBentleySnapshotFromWorkflow: jest.fn(),
}));

jest.mock("@/lib/revenue-os/run-research", () => ({
  runResearch: jest.fn(),
}));

jest.mock("@/lib/revenue-os/run-trends", () => ({
  runTrends: jest.fn(),
}));

const mockRunResearch = jest.mocked(runResearch);
const mockRunTrends = jest.mocked(runTrends);

function minimalSnapshot(): BentleySnapshot {
  return {
    industryKey: "consulting",
    contentIndustry: "Consulting",
    targetAudience: "SMB owners",
    traffic: 5000,
    conversionRate: 2,
    aov: 500,
    businessName: "Pipeline Test Co",
    coreOffer: "Offer",
    transformation: "Growth",
    platforms: ["LinkedIn"],
    postingPlatforms: ["linkedin"],
    tone: "Professional",
    contentType: "Full Post",
    imageStyle: "cinematic",
    campaignNotes: "x".repeat(120),
  };
}

function ctx() {
  return {
    userId: "u-pipe",
    clientId: "c-pipe",
    getSnapshot: () => minimalSnapshot(),
    applyPatch: jest.fn(),
  };
}

describe("runFullPipelineAction", () => {
  beforeEach(() => {
    resetWorkflowState();
    sessionStorage.clear();
    jest.clearAllMocks();
    jest.spyOn(RunLock, "tryAcquireRunLock").mockReturnValue(true);
    jest.spyOn(RunLock, "releaseRunLock").mockImplementation(() => {});
    mockRunResearch.mockResolvedValue({ whatPeopleWant: [{ title: "a" }] } as never);
    mockRunTrends.mockResolvedValue({
      trends: { items: [{ id: "1" }] },
      synthesis: { campaignAngles: [] },
    } as never);
  });

  it("returns blocked when the run lock cannot be acquired (no pipeline side effects)", async () => {
    jest.spyOn(RunLock, "tryAcquireRunLock").mockReturnValue(false);

    const r = await runFullPipelineAction(ctx());

    expect(r.ok).toBe(false);
    expect(r.status).toBe("blocked");
    expect(mockRunResearch).not.toHaveBeenCalled();
    expect(PipelineSync.reconcileBentleySnapshotFromWorkflow).not.toHaveBeenCalled();
  });

  it("skips already-completed phases without calling downstream runners", async () => {
    const complete: BentleyWorkflowState = {
      ...defaultWorkflowState(),
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
        research: { whatPeopleWant: [] } as never,
        trends: {} as never,
        synthesis: {} as never,
        marketSweep: {} as never,
        contentEngine: {} as never,
        campaign: {} as never,
        mediaBriefText: "brief",
        analysisComplete: true,
      },
      updatedAt: Date.now(),
    };
    saveWorkflowState(complete);

    const r = await runFullPipelineAction(ctx());

    expect(r.ok).toBe(true);
    expect(r.status).toBe("complete");
    expect(mockRunResearch).not.toHaveBeenCalled();
    expect(mockRunTrends).not.toHaveBeenCalled();
    expect(PipelineSync.reconcileBentleySnapshotFromWorkflow).toHaveBeenCalled();
  });

  it("preserves earlier completed phases when a later phase fails (monotonic completion)", async () => {
    const seeded: BentleyWorkflowState = {
      ...defaultWorkflowState(),
      completed: {
        intake: true,
        research: true,
      },
      artifacts: {
        research: { whatPeopleWant: [{ title: "kept" }] } as never,
      },
      updatedAt: Date.now(),
    };
    saveWorkflowState(seeded);

    mockRunTrends.mockResolvedValue({ items: null } as never);

    const r = await runFullPipelineAction(ctx());

    expect(r.ok).toBe(false);
    expect(r.status).toBe("failed");

    const after = loadWorkflowState();
    expect(after.completed.research).toBe(true);
    expect(after.artifacts.research).toBeTruthy();
    expect(after.completed.trends).toBeFalsy();
  });
});
