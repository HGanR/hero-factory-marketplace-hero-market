/**
 * Executive Bentley HUD view model — derived from real snapshot + workflow artifacts.
 */

import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import { effectiveIndustryLabelFromSnapshot } from "@/lib/revenue-os/bentley-section-readiness";
import { loadWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import type { CampaignResponse } from "@/lib/revenue-os/campaign-schema";
import { executiveBentleyIntakeComplete, executiveBentleyOpeningQuestion } from "@/lib/revenue-os/executive-bentley-intake";
import {
  deriveExecutiveBentleyStageTracker,
  type ExecutiveBentleyStageTrackerState,
} from "@/lib/revenue-os/executive-bentley-stage-tracker";

export type ExecutiveBentleyHudCampaignOutputs = {
  hooks: string[];
  captions: string[];
  imagePrompts: string[];
  videoPrompts: string[];
  postingRecommendations: string[];
  kpiExpectations: string[];
};

export type ExecutiveBentleyHudState = ExecutiveBentleyStageTrackerState & {
  headline: string;
  subline: string;
  intakeComplete: boolean;
  nextQuestion: string | null;
  industryLabel: string;
  businessName: string;
  outputs: ExecutiveBentleyHudCampaignOutputs;
  launchGated: boolean;
  content360Governed: boolean;
};

function extractOutputs(snap: BentleySnapshot): ExecutiveBentleyHudCampaignOutputs {
  const wf = loadWorkflowState();
  const campaign = wf.artifacts?.campaign as CampaignResponse | undefined;
  const hooks = (campaign?.shortFormHooks ?? []).slice(0, 6);
  const captions: string[] = [];
  const imagePrompts: string[] = [];
  const videoPrompts: string[] = [];
  for (const p of campaign?.platformPosts ?? []) {
    if (p.caption) captions.push(p.caption);
    if (p.promptImage) imagePrompts.push(p.promptImage);
    if (p.promptVideo) videoPrompts.push(p.promptVideo);
  }
  const postingRecommendations = snap.postingPlatforms?.length
    ? [`OAuth targets: ${snap.postingPlatforms.join(", ")}`]
    : snap.platforms?.length
      ? [`Strategy platforms: ${snap.platforms.join(", ")}`]
      : [];
  const kpiExpectations: string[] = [];
  if (snap.traffic > 0) kpiExpectations.push(`Traffic baseline: ${snap.traffic.toLocaleString()}/mo`);
  if (snap.conversionRate > 0) kpiExpectations.push(`Conversion: ${snap.conversionRate}%`);
  if (snap.aov > 0) kpiExpectations.push(`AOV: $${snap.aov.toLocaleString()}`);

  return {
    hooks,
    captions: captions.slice(0, 4),
    imagePrompts: imagePrompts.slice(0, 4),
    videoPrompts: videoPrompts.slice(0, 4),
    postingRecommendations,
    kpiExpectations,
  };
}

export function buildExecutiveBentleyHudState(
  snap: BentleySnapshot,
  opts?: {
    pendingApprovals?: number | null;
    content360Configured?: boolean;
    pipelineDetail?: import("@/lib/revenue-os/bentley-pipeline-progress").BentleyPipelineProgressDetail | null;
  },
): ExecutiveBentleyHudState {
  const tracker = deriveExecutiveBentleyStageTracker(snap, opts?.pipelineDetail ?? null, opts);
  const intakeComplete = executiveBentleyIntakeComplete(snap);
  const industryLabel = effectiveIndustryLabelFromSnapshot(snap);
  const businessName = snap.businessName?.trim() || "Campaign intake";
  const headline = intakeComplete
    ? `${businessName} — Bentley campaign command`
    : "Bentley campaign intake";
  const subline = intakeComplete
    ? tracker.statusLine
    : "Skipper is collecting the same guided answers used on AI Revenue OS.";

  return {
    ...tracker,
    headline,
    subline,
    intakeComplete,
    nextQuestion: intakeComplete ? null : executiveBentleyOpeningQuestion(snap),
    industryLabel,
    businessName,
    outputs: extractOutputs(snap),
    launchGated: true,
    content360Governed: Boolean(opts?.content360Configured),
  };
}
