/**
 * Executive-visible workflow stages mapped to real Bentley pipeline + governance.
 */

import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import {
  loadWorkflowState,
  type BentleyWorkflowPhaseId,
  type BentleyWorkflowState,
} from "@/lib/revenue-os/bentley-workflow";
import { structuredGuidedIntakeCompleteForCampaign } from "@/lib/revenue-os/bentley-orchestrator";
import type { CampaignResponse } from "@/lib/revenue-os/campaign-schema";

export type ExecutiveBentleyStageId =
  | "intake"
  | "trend_analysis"
  | "market_sweep"
  | "audience_targeting"
  | "hook_generation"
  | "content_generation"
  | "prompt_generation"
  | "media_staging"
  | "campaign_assembly"
  | "launch_readiness"
  | "approval_queue"
  | "content360_preparation";

export type ExecutiveBentleyStageStatus = "pending" | "active" | "complete" | "blocked" | "failed";

export type ExecutiveBentleyStage = {
  id: ExecutiveBentleyStageId;
  label: string;
  status: ExecutiveBentleyStageStatus;
  detail?: string;
};

export const EXECUTIVE_BENTLEY_STAGE_ORDER: ExecutiveBentleyStageId[] = [
  "intake",
  "trend_analysis",
  "market_sweep",
  "audience_targeting",
  "hook_generation",
  "content_generation",
  "prompt_generation",
  "media_staging",
  "campaign_assembly",
  "launch_readiness",
  "approval_queue",
  "content360_preparation",
];

const STAGE_LABELS: Record<ExecutiveBentleyStageId, string> = {
  intake: "Intake",
  trend_analysis: "Trend analysis",
  market_sweep: "Market sweep",
  audience_targeting: "Audience targeting",
  hook_generation: "Hook generation",
  content_generation: "Content generation",
  prompt_generation: "Prompt generation",
  media_staging: "Media staging",
  campaign_assembly: "Campaign assembly",
  launch_readiness: "Launch readiness",
  approval_queue: "Approval queue",
  content360_preparation: "Content360 preparation",
};

function phaseComplete(state: BentleyWorkflowState, phase: BentleyWorkflowPhaseId): boolean {
  return Boolean(state.completed?.[phase]);
}

function campaignArtifacts(state: BentleyWorkflowState): CampaignResponse | null {
  const c = state.artifacts?.campaign;
  return c && typeof c === "object" ? (c as CampaignResponse) : null;
}

/** Derive executive stage row from real workflow + snapshot (no fake progress). */
export function buildExecutiveBentleyWorkflowStages(
  snap: BentleySnapshot,
  wf: BentleyWorkflowState = loadWorkflowState(),
  opts?: {
    activePhase?: BentleyWorkflowPhaseId | null;
    pipelineMode?: "idle" | "running" | "complete" | "failed";
    pendingApprovals?: number | null;
    content360Configured?: boolean;
  },
): ExecutiveBentleyStage[] {
  const intakeDone = structuredGuidedIntakeCompleteForCampaign(snap) || phaseComplete(wf, "intake");
  const campaign = campaignArtifacts(wf);
  const hooksReady = Boolean(campaign?.shortFormHooks?.length);
  const contentReady = Boolean(wf.artifacts?.contentEngine);
  const promptsReady = Boolean(
    campaign?.platformPosts?.some((p) => p.promptText || p.promptImage || p.promptVideo),
  );
  const mediaReady = Boolean(wf.artifacts?.mediaBrief);
  const analysisDone = phaseComplete(wf, "analysis") || Boolean(snap.pipeline?.analysisComplete);
  const launchReady =
    Boolean(snap.pipeline?.launchReady) ||
    phaseComplete(wf, "launch_ready") ||
    Boolean(wf.artifacts?.bentleyLaunchSyncedAt);

  const active = opts?.activePhase ?? null;
  const running = opts?.pipelineMode === "running";

  function statusFor(
    id: ExecutiveBentleyStageId,
    complete: boolean,
    phaseIds: BentleyWorkflowPhaseId[],
  ): ExecutiveBentleyStageStatus {
    if (complete) return "complete";
    if (opts?.pipelineMode === "failed" && active && phaseIds.includes(active)) return "failed";
    if (running && active && phaseIds.includes(active)) return "active";
    return "pending";
  }

  return EXECUTIVE_BENTLEY_STAGE_ORDER.map((id) => {
    let status: ExecutiveBentleyStageStatus = "pending";
    let detail: string | undefined;

    switch (id) {
      case "intake":
        status = intakeDone ? "complete" : running && active === "intake" ? "active" : snap.businessName ? "active" : "pending";
        if (!intakeDone && snap.businessName) detail = "Answering guided questions";
        break;
      case "trend_analysis":
        status = statusFor(id, phaseComplete(wf, "trends") || Boolean(wf.artifacts?.trends), ["trends"]);
        break;
      case "market_sweep":
        status = statusFor(id, phaseComplete(wf, "market_sweep") || Boolean(wf.artifacts?.marketSweep), [
          "market_sweep",
        ]);
        break;
      case "audience_targeting":
        status = snap.targetAudience?.trim() ? "complete" : intakeDone ? "active" : "pending";
        break;
      case "hook_generation":
        status = statusFor(id, hooksReady, ["campaign_generation"]);
        if (hooksReady) detail = `${campaign!.shortFormHooks!.length} hooks`;
        break;
      case "content_generation":
        status = statusFor(id, contentReady || phaseComplete(wf, "content"), ["content"]);
        break;
      case "prompt_generation":
        status = statusFor(id, promptsReady || phaseComplete(wf, "campaign_generation"), ["campaign_generation"]);
        break;
      case "media_staging":
        status = statusFor(id, mediaReady || phaseComplete(wf, "media_brief"), ["media_brief"]);
        break;
      case "campaign_assembly":
        status = statusFor(id, Boolean(campaign) || phaseComplete(wf, "campaign_generation"), [
          "campaign_generation",
          "campaign_notes",
        ]);
        break;
      case "launch_readiness":
        status = launchReady ? "complete" : analysisDone ? "active" : "pending";
        break;
      case "approval_queue":
        if ((opts?.pendingApprovals ?? 0) > 0) {
          status = "blocked";
          detail = `${opts!.pendingApprovals} pending`;
        } else if (launchReady) {
          status = "complete";
        } else {
          status = "pending";
        }
        break;
      case "content360_preparation":
        if (!opts?.content360Configured) {
          status = "pending";
          detail = "Not configured";
        } else if (launchReady) {
          status = "complete";
          detail = "Governed route available";
        } else {
          status = "pending";
        }
        break;
      default:
        break;
    }

    return { id, label: STAGE_LABELS[id], status, detail };
  });
}

export function executiveBentleyCompletedStageCount(stages: ExecutiveBentleyStage[]): number {
  return stages.filter((s) => s.status === "complete").length;
}
