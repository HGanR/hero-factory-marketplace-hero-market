/**
 * Non-breaking pipeline handoff recommendations: what “Next” should mean after Step 4 artifacts.
 * Recommends / prefills only — does not auto-post or mutate workflow storage.
 */

import type { BentleyWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import type { SocialPlatform } from "@/lib/social/config";

export type BentleyPipelineHandoffStage =
  | "intake"
  | "research_and_trends"
  | "content_and_campaign"
  | "deployment_drafts"
  | "connect_accounts"
  | "schedule_review";

export type AdvanceBentleyPipelineStageArgs = {
  intakeComplete: boolean;
  workflow: BentleyWorkflowState;
  /** From {@link buildDeploymentReadyPostDrafts} length */
  deploymentDraftCount: number;
  connectedOauthPlatforms: Iterable<SocialPlatform>;
  /** OAuth-capable platforms derived from intake (normalized). */
  targetOauthPlatforms: SocialPlatform[];
};

export type AdvanceBentleyPipelineStageResult = {
  stage: BentleyPipelineHandoffStage;
  headline: string;
  nextActions: string[];
  shouldResumeAutomatedPipeline: boolean;
  shouldOpenDeploymentPanel: boolean;
  shouldOpenConnectFlow: boolean;
  shouldOpenScheduleReview: boolean;
};

function hasConnectedForTargets(
  connected: Set<SocialPlatform>,
  targets: SocialPlatform[]
): boolean {
  if (!targets.length) return false;
  return targets.every((p) => connected.has(p));
}

export function advanceBentleyPipelineStage(
  args: AdvanceBentleyPipelineStageArgs
): AdvanceBentleyPipelineStageResult {
  const wf = args.workflow;
  const connected = new Set<SocialPlatform>(args.connectedOauthPlatforms);
  const targets = args.targetOauthPlatforms;

  if (!args.intakeComplete) {
    return {
      stage: "intake",
      headline: "Finish guided intake so Bentley can anchor industry, offer, and platforms.",
      nextActions: [
        "Complete the remaining questions in the AI Revenue OS guided flow.",
        "When intake is complete, run **Resume pipeline** or **Run Revenue OS pipeline** once.",
      ],
      shouldResumeAutomatedPipeline: false,
      shouldOpenDeploymentPanel: false,
      shouldOpenConnectFlow: false,
      shouldOpenScheduleReview: false,
    };
  }

  if (!wf.artifacts.research && !wf.completed.research) {
    return {
      stage: "research_and_trends",
      headline: "Run industry research to ground the campaign in live signals.",
      nextActions: [
        "Open **Research Assistant** and run a research pass for your niche.",
        "Then run **Trends Library** / synthesis — or tap **Run Revenue OS pipeline** to automate.",
      ],
      shouldResumeAutomatedPipeline: true,
      shouldOpenDeploymentPanel: false,
      shouldOpenConnectFlow: false,
      shouldOpenScheduleReview: false,
    };
  }

  if (!wf.artifacts.trends && !wf.completed.trends) {
    return {
      stage: "research_and_trends",
      headline: "Capture trending angles before locking campaign copy.",
      nextActions: [
        "Run **Identify Trending Content** in Trends Library.",
        "Optionally continue the automated pipeline to merge synthesis into notes.",
      ],
      shouldResumeAutomatedPipeline: true,
      shouldOpenDeploymentPanel: false,
      shouldOpenConnectFlow: false,
      shouldOpenScheduleReview: false,
    };
  }

  const hasContent = Boolean(wf.artifacts.contentEngine || wf.completed.content);
  const hasCampaign = Boolean(wf.artifacts.campaign || wf.completed.campaign_generation);

  if (!hasContent) {
    return {
      stage: "content_and_campaign",
      headline: "Generate a content bundle (hooks + caption stack) for deployment.",
      nextActions: [
        "Run **Generate Viral Content** in Content Engine.",
        "Then assemble **Paste Notes** and **Generate Campaign** when you’re ready.",
      ],
      shouldResumeAutomatedPipeline: true,
      shouldOpenDeploymentPanel: false,
      shouldOpenConnectFlow: false,
      shouldOpenScheduleReview: false,
    };
  }

  if (!hasCampaign) {
    return {
      stage: "content_and_campaign",
      headline: "Generate campaign hooks and pillars from your notes bundle.",
      nextActions: [
        "Review **Paste Notes**, then tap **Generate Campaign**.",
        "Optional: **Compile Media Brief** before external video tools.",
      ],
      shouldResumeAutomatedPipeline: true,
      shouldOpenDeploymentPanel: false,
      shouldOpenConnectFlow: false,
      shouldOpenScheduleReview: false,
    };
  }

  if (args.deploymentDraftCount === 0) {
    return {
      stage: "deployment_drafts",
      headline: "Prepare deployment-ready draft posts from your saved artifacts.",
      nextActions: [
        "Open **Deployment readiness** (Step 4) and tap **Create Draft Posts** when it’s enabled.",
        "Nothing auto-publishes — this only creates DRAFT rows you can review.",
      ],
      shouldResumeAutomatedPipeline: false,
      shouldOpenDeploymentPanel: true,
      shouldOpenConnectFlow: false,
      shouldOpenScheduleReview: false,
    };
  }

  if (targets.length && !hasConnectedForTargets(connected, targets)) {
    return {
      stage: "connect_accounts",
      headline: "Connect OAuth accounts for the platforms in your draft queue.",
      nextActions: [
        "Use **Connect Accounts** under Launch / deployment — match platforms you chose in intake.",
        "If OAuth isn’t available for a network, keep drafts and publish manually from the brief.",
      ],
      shouldResumeAutomatedPipeline: false,
      shouldOpenDeploymentPanel: true,
      shouldOpenConnectFlow: true,
      shouldOpenScheduleReview: false,
    };
  }

  return {
    stage: "schedule_review",
    headline: "Review drafts, add assets, and schedule or publish manually.",
    nextActions: [
      "Open **Review Draft Queue** (dashboard **Launch Campaigns**) to attach video/images.",
      "Use **Prepare Schedule** to set `scheduledAt` when you want — automated workers are not required for manual publish.",
    ],
    shouldResumeAutomatedPipeline: false,
    shouldOpenDeploymentPanel: true,
    shouldOpenConnectFlow: false,
    shouldOpenScheduleReview: true,
  };
}
