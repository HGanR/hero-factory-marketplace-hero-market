/**
 * @jest-environment jsdom
 *
 * Workflow-authoritative pipeline flags: derive, reconcile, resume eligibility, monotonic merge.
 */
import { describe, it, expect } from "@jest/globals";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import { mergePipelineStages } from "@/lib/revenue-os/bentley-orchestrator";
import {
  derivePipelineStagesFromWorkflowState,
  detectBentleyPipelineWorkflowMismatches,
} from "@/lib/revenue-os/bentley-pipeline-stage-sync";
import {
  defaultWorkflowState,
  saveWorkflowState,
  resetWorkflowState,
  workflowShowsResumeablePartialRun,
  type BentleyWorkflowState,
} from "@/lib/revenue-os/bentley-workflow";

function baseSnap(over?: Partial<BentleySnapshot>): BentleySnapshot {
  return {
    industryKey: "consulting",
    contentIndustry: "Consulting",
    targetAudience: "SMB",
    traffic: 1,
    conversionRate: 1,
    aov: 1,
    businessName: "Co",
    coreOffer: "Offer",
    transformation: "Grow",
    platforms: ["LinkedIn"],
    postingPlatforms: ["linkedin"],
    tone: "Professional",
    contentType: "Full Post",
    imageStyle: "cinematic",
    campaignNotes: "x".repeat(120),
    ...over,
  };
}

describe("derivePipelineStagesFromWorkflowState", () => {
  it("sets contentGenerated when workflow has content artifact with caption", () => {
    const snap = baseSnap({ pipeline: {} });
    const wf: BentleyWorkflowState = {
      ...defaultWorkflowState(),
      completed: { ...defaultWorkflowState().completed, content: true },
      artifacts: {
        contentEngine: { fullPost: { caption: "Hello world" }, hooks: [] } as never,
      },
      updatedAt: Date.now(),
    };
    const d = derivePipelineStagesFromWorkflowState(snap, wf);
    expect(d.contentGenerated).toBe(true);
  });

  it("sets campaignGenerated when workflow completed campaign_generation with campaign artifact", () => {
    const snap = baseSnap({ pipeline: {} });
    const wf: BentleyWorkflowState = {
      ...defaultWorkflowState(),
      completed: { campaign_generation: true },
      artifacts: {
        campaign: { offerStatement: "We help you win" } as never,
      },
      updatedAt: Date.now(),
    };
    const d = derivePipelineStagesFromWorkflowState(snap, wf);
    expect(d.campaignGenerated).toBe(true);
  });

  it("sets analysisComplete when analysis phase and artifact flag are done", () => {
    const snap = baseSnap({ pipeline: {} });
    const wf: BentleyWorkflowState = {
      ...defaultWorkflowState(),
      completed: { analysis: true },
      artifacts: { analysisComplete: true },
      updatedAt: Date.now(),
    };
    const d = derivePipelineStagesFromWorkflowState(snap, wf);
    expect(d.analysisComplete).toBe(true);
  });
});

describe("hydration self-heal (monotonic merge)", () => {
  it("raises stale snapshot flags to match workflow-derived stages", () => {
    const stale: BentleySnapshot = baseSnap({
      pipeline: {
        intakeComplete: true,
        contentGenerated: false,
        campaignGenerated: false,
        analysisComplete: false,
        launchReady: false,
      },
    });
    const wf: BentleyWorkflowState = {
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
        contentEngine: { fullPost: { caption: "x" }, hooks: [] } as never,
        campaign: { offerStatement: "o" } as never,
        analysisComplete: true,
      },
      updatedAt: Date.now(),
    };
    const derived = derivePipelineStagesFromWorkflowState(stale, wf);
    const healed = mergePipelineStages(stale.pipeline, derived);
    expect(healed.contentGenerated).toBe(true);
    expect(healed.campaignGenerated).toBe(true);
    expect(healed.analysisComplete).toBe(true);
    expect(healed.launchReady).toBe(true);
  });

  it("does not clear upstream completion when a later phase failed in workflow", () => {
    const snap = baseSnap({
      pipeline: {
        intakeComplete: true,
        contentGenerated: true,
        campaignGenerated: false,
        analysisComplete: false,
        launchReady: false,
      },
    });
    const wf: BentleyWorkflowState = {
      ...defaultWorkflowState(),
      completed: {
        intake: true,
        research: true,
        trends: true,
        market_sweep: true,
        content: true,
      },
      lastFailedPhase: "campaign_generation",
      artifacts: {
        contentEngine: { fullPost: { caption: "ok" }, hooks: [] } as never,
      },
      updatedAt: Date.now(),
    };
    const derived = derivePipelineStagesFromWorkflowState(snap, wf);
    const merged = mergePipelineStages(snap.pipeline, derived);
    expect(merged.contentGenerated).toBe(true);
    expect(merged.campaignGenerated).toBe(false);
  });
});

describe("detectBentleyPipelineWorkflowMismatches (sessionStorage)", () => {
  beforeEach(() => {
    resetWorkflowState();
    sessionStorage.clear();
  });

  it("reports lagging when workflow is ahead of snapshot", () => {
    const wf: BentleyWorkflowState = {
      ...defaultWorkflowState(),
      completed: { content: true },
      artifacts: {
        contentEngine: { fullPost: { caption: "Hi" }, hooks: [] } as never,
      },
      updatedAt: Date.now(),
    };
    saveWorkflowState(wf);
    const snap = baseSnap({ pipeline: { contentGenerated: false } });
    const issues = detectBentleyPipelineWorkflowMismatches(snap);
    expect(issues.some((x) => x.includes("lagging") && x.includes("content"))).toBe(true);
  });
});

describe("workflowShowsResumeablePartialRun", () => {
  it("is true when trends done but analysis not (no research-only constraint)", () => {
    const wf: BentleyWorkflowState = {
      ...defaultWorkflowState(),
      completed: { intake: true, research: true, trends: true, market_sweep: true },
      updatedAt: Date.now(),
    };
    expect(workflowShowsResumeablePartialRun(wf)).toBe(true);
  });

  it("is false when next phase is dashboard", () => {
    const wf: BentleyWorkflowState = {
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
      updatedAt: Date.now(),
    };
    expect(workflowShowsResumeablePartialRun(wf)).toBe(false);
  });
});

describe("intakeComplete monotonicity", () => {
  it("preserves intakeComplete on snapshot when mergePipelineStages reconciles other fields", () => {
    const snap = baseSnap({
      pipeline: { intakeComplete: true, contentGenerated: false, campaignGenerated: false, analysisComplete: false, launchReady: false },
    });
    const wf: BentleyWorkflowState = {
      ...defaultWorkflowState(),
      completed: { intake: true, content: true },
      artifacts: {
        contentEngine: { fullPost: { caption: "c" }, hooks: [] } as never,
      },
      updatedAt: Date.now(),
    };
    const derived = derivePipelineStagesFromWorkflowState(snap, wf);
    const merged = mergePipelineStages(snap.pipeline, derived);
    expect(merged.intakeComplete).toBe(true);
    expect(merged.contentGenerated).toBe(true);
  });
});
