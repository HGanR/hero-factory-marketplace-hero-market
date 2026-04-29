/**
 * Compact 7-stage operator view for Bentley autonomous pipeline (snapshot + workflow + live progress).
 * Completion is monotonic: once a stage is complete, later syncs never clear it in UI.
 */

import type { BentleyPipelineProgressDetail } from "@/lib/revenue-os/bentley-pipeline-progress";
import {
  DEFAULT_PIPELINE_STAGES,
  mergePipelineStages,
  type BentleyPipelineStageState,
  type BentleySnapshot,
} from "@/lib/revenue-os/bentley-orchestrator";
import type { BentleyWorkflowPhaseId, BentleyWorkflowState } from "@/lib/revenue-os/bentley-workflow";

export const BENTLEY_OPERATOR_STAGE_IDS = [
  "intake",
  "research",
  "trends",
  "content",
  "campaign",
  "analysis",
  "launch",
] as const;

export type BentleyOperatorStageId = (typeof BENTLEY_OPERATOR_STAGE_IDS)[number];

export type OperatorStageVisual = "complete" | "current" | "next" | "waiting" | "blocked";

export type OperatorStageRow = {
  id: BentleyOperatorStageId;
  label: string;
  visual: OperatorStageVisual;
};

export type BentleyOperatorDominantCtaKind =
  | "continue_bentley"
  | "run_next_stage"
  | "open_dashboard"
  | "open_launch_campaign";

export type BentleyOperatorPipelineModel = {
  stages: OperatorStageRow[];
  currentLine: string;
  nextLine: string;
  cta: {
    kind: BentleyOperatorDominantCtaKind;
    label: string;
    href?: string;
    dispatchResumePipeline?: boolean;
    dispatchOpenBentley?: boolean;
  };
};

const STAGE_LABELS: Record<BentleyOperatorStageId, string> = {
  intake: "Intake",
  research: "Research",
  trends: "Trends",
  content: "Content",
  campaign: "Campaign",
  analysis: "Analysis",
  launch: "Launch",
};

/** Maps workflow engine phase to one of 7 operator columns (market_sweep sits under Trends). */
export function workflowPhaseToOperatorStageIndex(phase: BentleyWorkflowPhaseId): number {
  switch (phase) {
    case "intake":
      return 0;
    case "research":
      return 1;
    case "trends":
    case "market_sweep":
      return 2;
    case "content":
      return 3;
    case "campaign_notes":
    case "campaign_generation":
    case "media_brief":
      return 4;
    case "analysis":
      return 5;
    case "dashboard":
    case "launch_ready":
      return 6;
    default:
      return 0;
  }
}

function pipelineMerged(snap: BentleySnapshot): BentleyPipelineStageState {
  return mergePipelineStages(DEFAULT_PIPELINE_STAGES, snap.pipeline);
}

/**
 * Raw completion from snapshot + workflow (non-monotonic — merge with {@link mergeOperatorCompletionMonotonic} in UI).
 */
export function deriveOperatorStageCompletionRaw(
  snap: BentleySnapshot,
  wf: BentleyWorkflowState
): boolean[] {
  const p = pipelineMerged(snap);
  return [
    p.intakeComplete,
    Boolean(wf.completed.research),
    Boolean(wf.completed.trends && wf.completed.market_sweep),
    p.contentGenerated,
    p.campaignGenerated,
    p.analysisComplete,
    p.launchReady,
  ];
}

export function mergeOperatorCompletionMonotonic(
  prev: boolean[] | null,
  raw: boolean[]
): boolean[] {
  const out = [...raw];
  if (prev && prev.length === out.length) {
    for (let i = 0; i < out.length; i++) {
      out[i] = Boolean(prev[i] || out[i]);
    }
  }
  return out;
}

function firstIncompleteIndex(done: boolean[]): number {
  const i = done.findIndex((d) => !d);
  return i === -1 ? done.length : i;
}

function currentStageLabelFromIndex(idx: number): string {
  if (idx >= BENTLEY_OPERATOR_STAGE_IDS.length) return "Pipeline complete";
  const id = BENTLEY_OPERATOR_STAGE_IDS[idx]!;
  return STAGE_LABELS[id];
}

function runningHeadline(active: BentleyWorkflowPhaseId): string {
  const idx = workflowPhaseToOperatorStageIndex(active);
  const id = BENTLEY_OPERATOR_STAGE_IDS[Math.min(idx, BENTLEY_OPERATOR_STAGE_IDS.length - 1)]!;
  return `Generating ${STAGE_LABELS[id]}`;
}

/**
 * Build per-stage visuals + copy + single dominant CTA.
 */
export function buildBentleyOperatorPipelineModel(args: {
  snapshot: BentleySnapshot;
  workflow: BentleyWorkflowState;
  progress: BentleyPipelineProgressDetail | null | undefined;
  /** Monotonic latched completion (same length as stages). */
  completion: boolean[];
}): BentleyOperatorPipelineModel {
  const { snapshot, workflow, progress, completion } = args;
  const done = completion;
  const failedPhase =
    progress?.mode === "failed" ? progress.failedPhase : workflow.lastFailedPhase ?? null;
  const running = progress?.mode === "running";
  const active = progress?.activePhase ?? null;

  const blockedIdx =
    failedPhase != null ? workflowPhaseToOperatorStageIndex(failedPhase) : null;

  const firstInc = firstIncompleteIndex(done);
  let currentIdx = firstInc >= BENTLEY_OPERATOR_STAGE_IDS.length ? BENTLEY_OPERATOR_STAGE_IDS.length - 1 : firstInc;

  if (running && active) {
    currentIdx = workflowPhaseToOperatorStageIndex(active);
  }
  if (blockedIdx != null && !running) {
    currentIdx = blockedIdx;
  }

  const stages: OperatorStageRow[] = BENTLEY_OPERATOR_STAGE_IDS.map((id, i) => {
    let visual: OperatorStageVisual;
    if (done[i]) {
      visual = "complete";
    } else if (blockedIdx === i) {
      visual = "blocked";
    } else if (running && active != null && workflowPhaseToOperatorStageIndex(active) === i) {
      visual = "current";
    } else if (!running && blockedIdx == null && i === firstInc) {
      visual = "current";
    } else if (!running && blockedIdx == null && i === firstInc + 1 && firstInc < BENTLEY_OPERATOR_STAGE_IDS.length) {
      visual = "next";
    } else {
      visual = "waiting";
    }
    return { id, label: STAGE_LABELS[id], visual };
  });

  const merged = pipelineMerged(snapshot);

  let currentLine: string;
  if (running && active) {
    currentLine = `Current: ${runningHeadline(active)}`;
  } else if (blockedIdx != null) {
    currentLine = `Current: Blocked at ${currentStageLabelFromIndex(blockedIdx)}`;
  } else if (merged.launchReady) {
    currentLine = "Current: Launch ready";
  } else if (firstInc >= BENTLEY_OPERATOR_STAGE_IDS.length) {
    currentLine = "Current: Finalizing launch readiness";
  } else {
    currentLine = `Current: ${currentStageLabelFromIndex(currentIdx)}`;
  }

  let nextLine: string;
  if (merged.launchReady) {
    nextLine = "Next: Open Launch Campaign — upload, connect accounts, publish.";
  } else if (blockedIdx != null) {
    nextLine = "Next: Resume pipeline to retry the failed step.";
  } else if (firstInc >= BENTLEY_OPERATOR_STAGE_IDS.length) {
    nextLine = "Next: Open Revenue OS Dashboard to review projections.";
  } else {
    const nextIdx = Math.min(firstInc + 1, BENTLEY_OPERATOR_STAGE_IDS.length - 1);
    nextLine =
      firstInc === BENTLEY_OPERATOR_STAGE_IDS.length - 1
        ? "Next: Finish analysis and deployment checks for launch."
        : `Next: ${currentStageLabelFromIndex(nextIdx)}`;
  }

  let cta: BentleyOperatorPipelineModel["cta"];
  if (merged.launchReady) {
    cta = {
      kind: "open_launch_campaign",
      label: "Open Launch Campaign",
      href: "/revenue-os/dashboard#campaign-launch",
    };
  } else if (!merged.intakeComplete) {
    cta = {
      kind: "continue_bentley",
      label: "Continue",
      dispatchOpenBentley: true,
    };
  } else if (blockedIdx != null || workflow.lastError?.trim()) {
    cta = {
      kind: "run_next_stage",
      label: "Run next stage",
      dispatchResumePipeline: true,
    };
  } else if (merged.analysisComplete && !merged.launchReady) {
    cta = {
      kind: "open_dashboard",
      label: "Open Revenue OS dashboard",
      href: "/revenue-os/dashboard",
    };
  } else {
    cta = {
      kind: "run_next_stage",
      label: "Run next stage",
      dispatchResumePipeline: true,
    };
  }

  return { stages, currentLine, nextLine, cta };
}

/**
 * Campaign row copy for Launch section — distinguishes not-yet vs syncing vs ready.
 */
export function describeBentleyCampaignArtifactForLaunch(args: {
  campaignGenerated: boolean;
  /** True when snapshot has campaign material (name/caption/hooks path). */
  hasLaunchPrefillBody: boolean;
  workflow: BentleyWorkflowState;
}): { shortLabel: string; detail?: string } {
  const { campaignGenerated, hasLaunchPrefillBody, workflow: wf } = args;
  if (campaignGenerated) {
    return {
      shortLabel: "Ready",
      detail: hasLaunchPrefillBody ? "Campaign output on snapshot" : "Artifact flag set — copy may still be loading",
    };
  }
  if (wf.completed.campaign_generation) {
    return {
      shortLabel: "Merging to Launch",
      detail: "Campaign generation finished — updating Launch Campaign fields from snapshot",
    };
  }
  if (
    wf.currentPhase === "campaign_generation" ||
    wf.currentPhase === "campaign_notes" ||
    wf.currentPhase === "media_brief"
  ) {
    return {
      shortLabel: "Campaign running",
      detail: "Pipeline is generating or bundling campaign assets before snapshot merge",
    };
  }
  return {
    shortLabel: "Awaiting campaign",
    detail: "Run prior pipeline steps, then Generate Campaign when Paste Notes are ready",
  };
}
