import {
  isMultiStepPublishApprovalChain,
  parseCampaignPublishApprovalChainJson,
  requiredReviewerRoleForChainStep,
} from "@/lib/revenue-os/publish-approval-chain";
import { mergePublishApprovalGovernanceIntoUtm } from "@/lib/revenue-os/publish-approval-governance-merge";
import type { ResolvedPublishApprovalActor } from "@/lib/revenue-os/resolve-publish-approval-actor";

/**
 * Seed `utmParams` for a new campaign post so governance + worker gates match existing semantics.
 */
export function seedGovernanceUtmForNewSocialPost(args: {
  requireApproval: boolean;
  campaignPublishApprovalChainJson: unknown;
  actor: ResolvedPublishApprovalActor;
  nowIso: string;
}): Record<string, string> {
  const { requireApproval, actor, nowIso } = args;
  const base: Record<string, string> = {};

  if (!requireApproval) {
    return mergePublishApprovalGovernanceIntoUtm({
      base,
      status: "not_required",
      actor,
      nowIso,
    });
  }

  const chain = parseCampaignPublishApprovalChainJson(args.campaignPublishApprovalChainJson);
  const multi = Boolean(chain && isMultiStepPublishApprovalChain(chain));
  if (multi && chain) {
    const first = requiredReviewerRoleForChainStep(chain, 0);
    return mergePublishApprovalGovernanceIntoUtm({
      base,
      status: "pending_approval",
      actor,
      nowIso,
      pendingChainSeed: first
        ? {
            totalSteps: chain.steps.length,
            stepIndex: 0,
            requiredRole: first,
          }
        : null,
    });
  }

  return mergePublishApprovalGovernanceIntoUtm({
    base,
    status: "pending_approval",
    actor,
    nowIso,
  });
}
