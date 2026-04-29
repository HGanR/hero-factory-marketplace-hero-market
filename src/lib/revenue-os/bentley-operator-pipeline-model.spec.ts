import { describe, it, expect } from "@jest/globals";
import {
  buildBentleyOperatorPipelineModel,
  deriveOperatorStageCompletionRaw,
  describeBentleyCampaignArtifactForLaunch,
  mergeOperatorCompletionMonotonic,
  workflowPhaseToOperatorStageIndex,
} from "@/lib/revenue-os/bentley-operator-pipeline-model";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import type { BentleyPipelineProgressDetail } from "@/lib/revenue-os/bentley-pipeline-progress";
import { defaultWorkflowState, type BentleyWorkflowState } from "@/lib/revenue-os/bentley-workflow";

function snap(over: Partial<BentleySnapshot["pipeline"]> = {}): BentleySnapshot {
  return {
    industryKey: "consulting",
    contentIndustry: "Consulting",
    targetAudience: "SMB",
    traffic: 1000,
    conversionRate: 1,
    aov: 100,
    businessName: "Acme",
    coreOffer: "Offer",
    transformation: "Growth",
    platforms: [],
    postingPlatforms: ["linkedin"],
    tone: "Pro",
    contentType: "Post",
    imageStyle: "clean",
    campaignNotes: "",
    pipeline: over,
  };
}

describe("mergeOperatorCompletionMonotonic", () => {
  it("never clears a previously completed stage", () => {
    const prev = [true, false, false, false, false, false, false];
    const raw = [false, false, false, false, false, false, false];
    expect(mergeOperatorCompletionMonotonic(prev, raw)).toEqual(prev);
  });

  it("accepts new completions", () => {
    const prev = [true, false, false, false, false, false, false];
    const raw = [true, true, false, false, false, false, false];
    expect(mergeOperatorCompletionMonotonic(prev, raw)).toEqual([true, true, false, false, false, false, false]);
  });
});

describe("buildBentleyOperatorPipelineModel", () => {
  const idleProgress: BentleyPipelineProgressDetail = {
    mode: "idle",
    activePhase: null,
    completedPhases: [],
    statusLine: "",
  };

  it("dominant CTA is Open Launch Campaign when launchReady", () => {
    const snapshot = snap({
      intakeComplete: true,
      analysisComplete: true,
      contentGenerated: true,
      campaignGenerated: true,
      launchReady: true,
    });
    const wf: BentleyWorkflowState = {
      ...defaultWorkflowState(),
      completed: { research: true, trends: true, market_sweep: true, content: true },
    };
    const done = deriveOperatorStageCompletionRaw(snapshot, wf);
    const m = buildBentleyOperatorPipelineModel({
      snapshot,
      workflow: wf,
      progress: idleProgress,
      completion: done,
    });
    expect(m.cta.kind).toBe("open_launch_campaign");
    expect(m.cta.label).toMatch(/Launch Campaign/i);
    expect(m.cta.href).toContain("campaign-launch");
    expect(m.nextLine).toMatch(/Open Launch Campaign/i);
  });

  it("shows blocked current line when failed phase set on progress", () => {
    const snapshot = snap({
      intakeComplete: true,
      analysisComplete: false,
      contentGenerated: false,
      campaignGenerated: false,
      launchReady: false,
    });
    const wf = defaultWorkflowState();
    const done = Array(7).fill(false) as boolean[];
    done[0] = true;
    const progress: BentleyPipelineProgressDetail = {
      mode: "failed",
      activePhase: null,
      completedPhases: [],
      failedPhase: "trends",
      statusLine: "x",
    };
    const m = buildBentleyOperatorPipelineModel({
      snapshot,
      workflow: { ...wf, lastFailedPhase: "trends" },
      progress,
      completion: mergeOperatorCompletionMonotonic(null, done),
    });
    expect(m.currentLine).toMatch(/Blocked/i);
    expect(m.stages[2]?.visual).toBe("blocked");
  });

  it("maps running research to current stage", () => {
    const snapshot = snap({ intakeComplete: true });
    const wf = defaultWorkflowState();
    const done = deriveOperatorStageCompletionRaw(snapshot, wf);
    const progress: BentleyPipelineProgressDetail = {
      mode: "running",
      activePhase: "research",
      completedPhases: [],
      statusLine: "…",
    };
    const m = buildBentleyOperatorPipelineModel({
      snapshot,
      workflow: wf,
      progress,
      completion: done,
    });
    expect(m.stages[1]?.visual).toBe("current");
    expect(m.currentLine).toMatch(/Current:/i);
  });
});

describe("workflowPhaseToOperatorStageIndex", () => {
  it("maps market_sweep to trends column", () => {
    expect(workflowPhaseToOperatorStageIndex("market_sweep")).toBe(2);
  });
});

describe("describeBentleyCampaignArtifactForLaunch", () => {
  it("distinguishes ready vs not yet vs syncing", () => {
    expect(
      describeBentleyCampaignArtifactForLaunch({
        campaignGenerated: true,
        hasLaunchPrefillBody: true,
        workflow: defaultWorkflowState(),
      }).shortLabel
    ).toBe("Ready");

    expect(
      describeBentleyCampaignArtifactForLaunch({
        campaignGenerated: false,
        hasLaunchPrefillBody: false,
        workflow: defaultWorkflowState(),
      }).shortLabel
    ).toBe("Awaiting campaign");

    const syncing = describeBentleyCampaignArtifactForLaunch({
      campaignGenerated: false,
      hasLaunchPrefillBody: false,
      workflow: {
        ...defaultWorkflowState(),
        completed: { campaign_generation: true },
      },
    });
    expect(syncing.shortLabel).toBe("Merging to Launch");
  });
});
