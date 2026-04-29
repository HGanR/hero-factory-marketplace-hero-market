/**
 * @jest-environment jsdom
 *
 * Integration-style: real `runFullPipelineAction`, workflow persistence, and stage ordering;
 * external POST/API entry points are mocked to return valid fixtures.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
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
import { runMarketSweep } from "@/lib/revenue-os/run-market-sweep";
import { runViralContent } from "@/lib/revenue-os/run-viral-content";
import { runCampaignFromNotes } from "@/lib/revenue-os/run-campaign";
import { runCompileMediaBrief } from "@/lib/revenue-os/run-media-brief";
import { runSynthesizePlan } from "@/lib/revenue-os/run-synthesize-plan";
import { runRevenueOsFullAnalysis } from "@/lib/revenue-os/run-revenue-os-analysis";
import * as RunLock from "@/lib/revenue-os/bentley-run-lock";
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
jest.mock("@/lib/revenue-os/run-market-sweep", () => ({
  runMarketSweep: jest.fn(),
}));
jest.mock("@/lib/revenue-os/run-viral-content", () => ({
  runViralContent: jest.fn(),
}));
jest.mock("@/lib/revenue-os/run-campaign", () => ({
  runCampaignFromNotes: jest.fn(),
}));
jest.mock("@/lib/revenue-os/run-media-brief", () => ({
  runCompileMediaBrief: jest.fn(),
}));
jest.mock("@/lib/revenue-os/run-synthesize-plan", () => ({
  ...jest.requireActual<typeof import("@/lib/revenue-os/run-synthesize-plan")>(
    "@/lib/revenue-os/run-synthesize-plan"
  ),
  runSynthesizePlan: jest.fn(),
}));
jest.mock("@/lib/revenue-os/run-revenue-os-analysis", () => ({
  runRevenueOsFullAnalysis: jest.fn(),
}));

const mockRunResearch = jest.mocked(runResearch);
const mockRunTrends = jest.mocked(runTrends);
const mockRunMarketSweep = jest.mocked(runMarketSweep);
const mockRunViralContent = jest.mocked(runViralContent);
const mockRunCampaignFromNotes = jest.mocked(runCampaignFromNotes);
const mockRunCompileMediaBrief = jest.mocked(runCompileMediaBrief);
const mockRunSynthesizePlan = jest.mocked(runSynthesizePlan);
const mockRunRevenueOsFullAnalysis = jest.mocked(runRevenueOsFullAnalysis);

/** Mutable snapshot so `applyPatch` and `getSnapshot` reflect the same intake + notes state. */
function createTestSnapshot(): BentleySnapshot {
  return {
    industryKey: "consulting",
    contentIndustry: "Consulting",
    targetAudience: "Entrepreneurs",
    traffic: 8000,
    conversionRate: 2,
    aov: 500,
    businessName: "ChainTest LLC",
    coreOffer: "Systems that scale",
    transformation: "Growth",
    platforms: ["TikTok"],
    postingPlatforms: ["tiktok"],
    tone: "Professional",
    contentType: "Full Post",
    imageStyle: "cinematic",
    campaignNotes: "x".repeat(140),
  };
}

let mutableSnapshot: BentleySnapshot;

function ctx() {
  return {
    userId: "u-chain",
    clientId: "c-chain",
    getSnapshot: () => mutableSnapshot,
    applyPatch: jest.fn((patch: Partial<BentleySnapshot>) => {
      Object.assign(mutableSnapshot, patch);
    }),
  };
}

function validMarketSweep() {
  return {
    trendingTopics: ["sweep-topic-a", "sweep-topic-b"],
    viralHooks: ["hook-one"],
    painPoints: ["pain-a"],
    buyingSignals: [],
    commentInsights: [],
    competitorAngles: [],
    contentGaps: [],
  };
}

function validCampaign() {
  return {
    offerStatement: "We help you scale",
    industry: "Consulting",
    targetAudience: "SMB",
    shortFormHooks: ["Hook 1"],
    messagePillars: [],
    longFormOutlines: [],
    objectionReplies: [],
  };
}

describe("runFullPipelineAction chain (integration-style)", () => {
  let lockSpy: jest.SpyInstance;

  beforeEach(() => {
    resetWorkflowState();
    sessionStorage.clear();
    jest.clearAllMocks();
    mutableSnapshot = createTestSnapshot();
    lockSpy = jest.spyOn(RunLock, "tryAcquireRunLock").mockReturnValue(true);
    jest.spyOn(RunLock, "releaseRunLock").mockImplementation(() => {});

    mockRunResearch.mockResolvedValue({ whatPeopleWant: [{ want: "speed" }] } as never);
    mockRunTrends.mockResolvedValue({ items: [{ id: "t1", title: "Angle" }] } as never);
    mockRunSynthesizePlan.mockResolvedValue({
      campaignAngles: [{ angle: "A", hook: "H" }],
    } as never);
    mockRunMarketSweep.mockResolvedValue(validMarketSweep() as never);
    mockRunViralContent.mockResolvedValue({
      content: { fullPost: { caption: "Go!" }, hooks: ["h1"] },
    } as never);
    mockRunCampaignFromNotes.mockResolvedValue(validCampaign() as never);
    mockRunCompileMediaBrief.mockResolvedValue("Media brief body text for video team.");
    mockRunRevenueOsFullAnalysis.mockResolvedValue({
      ok: true,
      data: { kpis: {} },
    } as never);
  });

  afterEach(() => {
    lockSpy.mockRestore();
  });

  it("runs remaining stages in order from a partially completed workflow through analysis (monotonic completion)", async () => {
    const partial: BentleyWorkflowState = {
      ...defaultWorkflowState(),
      completed: {
        intake: true,
        research: true,
        trends: true,
        market_sweep: true,
        content: true,
        // Stop before notes assembly so `buildBentleyNotesPayload` runs and Paste Notes includes market sweep.
      },
      artifacts: {
        research: { whatPeopleWant: [] } as never,
        trends: {} as never,
        synthesis: { campaignAngles: [{ angle: "A", hook: "H" }] } as never,
        marketSweep: validMarketSweep() as never,
        contentEngine: { fullPost: { caption: "x" }, hooks: [] } as never,
      },
      updatedAt: Date.now(),
    };
    saveWorkflowState(partial);

    const c = ctx();
    const r = await runFullPipelineAction(c);

    expect(r.ok).toBe(true);
    const wf = loadWorkflowState();
    expect(wf.completed.research).toBe(true);
    expect(wf.completed.trends).toBe(true);
    expect(wf.completed.market_sweep).toBe(true);
    expect(wf.completed.content).toBe(true);
    expect(wf.completed.campaign_notes).toBe(true);
    expect(wf.completed.campaign_generation).toBe(true);
    expect(wf.completed.media_brief).toBe(true);
    expect(wf.completed.analysis).toBe(true);

    expect(mockRunResearch).not.toHaveBeenCalled();
    expect(mockRunTrends).not.toHaveBeenCalled();
    expect(mockRunMarketSweep).not.toHaveBeenCalled();
    expect(mockRunViralContent).not.toHaveBeenCalled();
    expect(mockRunCampaignFromNotes).toHaveBeenCalled();
    expect(mockRunCompileMediaBrief).toHaveBeenCalled();
    expect(mockRunRevenueOsFullAnalysis).toHaveBeenCalled();

    const notesPatches = (c.applyPatch as jest.Mock).mock.calls
      .map((args: unknown[]) => (args[0] as { campaignNotes?: string }).campaignNotes)
      .filter((n): n is string => typeof n === "string");
    const assembled = notesPatches.find((n) => n.includes("Market intelligence sweep"));
    expect(assembled).toBeDefined();
    expect(assembled).toContain("sweep-topic-a");
    expect(mutableSnapshot.campaignNotes).toContain("Market intelligence sweep");
    expect(mutableSnapshot.campaignNotes).toContain("sweep-topic-a");
  });

  it("when market sweep fails, earlier stages stay complete (no regression of true flags)", async () => {
    const partial: BentleyWorkflowState = {
      ...defaultWorkflowState(),
      completed: {
        intake: true,
        research: true,
        trends: true,
      },
      artifacts: {
        research: { whatPeopleWant: [{ x: 1 }] } as never,
        trends: { items: [] } as never,
        synthesis: { campaignAngles: [] } as never,
      },
      updatedAt: Date.now(),
    };
    saveWorkflowState(partial);

    mockRunMarketSweep.mockResolvedValueOnce({
      trendingTopics: [],
      viralHooks: [],
      painPoints: [],
      buyingSignals: [],
      commentInsights: [],
      competitorAngles: [],
      contentGaps: [],
    } as never);

    const r = await runFullPipelineAction(ctx());

    expect(r.ok).toBe(false);
    const wf = loadWorkflowState();
    expect(wf.completed.research).toBe(true);
    expect(wf.completed.trends).toBe(true);
    expect(wf.completed.market_sweep).toBeFalsy();
    expect(mockRunViralContent).not.toHaveBeenCalled();
  });
});
