/**
 * Rule-based variant / next-step artifacts — ties to parent campaign for lineage (no LLM required).
 */

import type { BentleyOptimizationResult } from "@/lib/revenue-os/bentley-optimization";
import type { CampaignResponse } from "@/lib/revenue-os/campaign-schema";

export type BentleyOptimizationVariantDraft = {
  changeType: "content" | "operational" | "scheduling" | "platform_mix";
  captionHooksSuggested: string[];
  platformMixNote: string;
  schedulingNote: string;
  ctaEmphasisNote: string;
  /** Human-readable lineage string for operators. */
  lineageNote: string;
};

export function buildBentleyOptimizationVariantDraft(args: {
  parentCampaignId: string;
  optimizationRunId: string;
  campaign: CampaignResponse;
  result: BentleyOptimizationResult;
}): BentleyOptimizationVariantDraft {
  const { campaign, result, parentCampaignId, optimizationRunId } = args;
  const hooks = campaign.shortFormHooks?.length ? [...campaign.shortFormHooks] : ["Your core hook"];
  const offer = (campaign.offerStatement ?? "").trim() || "your offer";

  const captionHooksSuggested: string[] = [];
  switch (result.primaryDriver) {
    case "engagement":
      captionHooksSuggested.push(
        `Pattern interrupt: ${hooks[0] ?? "Stop scrolling —"} (test A)`,
        `Proof-first: "See how [segment] used ${offer.slice(0, 80)}…"`,
        `Question hook: "Still doing [old behavior]? Here's the shift…"`
      );
      break;
    case "traffic":
      captionHooksSuggested.push(hooks[0] ?? offer, `Cross-post angle for a second network: ${offer.slice(0, 100)}`);
      break;
    case "conversion":
      captionHooksSuggested.push(
        `Single CTA: one clear action + deadline tied to ${offer.slice(0, 60)}`,
        `Objection-aware: address the #1 doubt before the CTA.`
      );
      break;
    case "aov":
      captionHooksSuggested.push(`Bundle framing: tiered value for ${offer.slice(0, 80)}`, `Risk reversal near the ask.`);
      break;
    default:
      captionHooksSuggested.push(hooks[0] ?? offer);
  }

  const platformMixNote =
    result.primaryDriver === "traffic"
      ? "Add one additional OAuth-connected network from the planner; stagger posts 2+ hours apart."
      : "Keep current platform focus unless traffic diagnosis changes.";

  const schedulingNote =
    result.primaryDriver === "traffic"
      ? "Try two posting windows on days your audience is active; avoid stacking all posts same hour."
      : "Maintain schedule until engagement or reach signals move.";

  const ctaEmphasisNote =
    result.primaryDriver === "conversion"
      ? "Repeat one CTA in the last line; remove secondary links for this variant."
      : "Keep one primary CTA consistent with the parent campaign.";

  return {
    changeType:
      result.primaryDriver === "publish_friction" || result.primaryDriver === "approval_friction"
        ? "operational"
        : result.primaryDriver === "traffic"
          ? "platform_mix"
          : result.primaryDriver === "engagement" || result.primaryDriver === "conversion" || result.primaryDriver === "aov"
            ? "content"
            : "content",
    captionHooksSuggested: captionHooksSuggested.slice(0, 5),
    platformMixNote,
    schedulingNote,
    ctaEmphasisNote,
    lineageNote: `Variant derived from campaign ${parentCampaignId} via optimization run ${optimizationRunId}. Original offer preserved; edits are scoped to ${result.primaryDriver}.`,
  };
}

/**
 * Merge variant hooks into a copy of `bentley_generation_json` for a child campaign row.
 */
export function mergeVariantIntoBentleyGenerationJson(args: {
  generation: { campaign: CampaignResponse; platforms: string[]; postingPlatforms?: string[]; syncedAt: string };
  variant: BentleyOptimizationVariantDraft;
}): { campaign: CampaignResponse; platforms: string[]; postingPlatforms?: string[]; syncedAt: string } {
  const hooks = [
    ...args.variant.captionHooksSuggested,
    ...(args.generation.campaign.shortFormHooks ?? []),
  ].filter((h, i, a) => a.indexOf(h) === i);
  return {
    ...args.generation,
    syncedAt: new Date().toISOString(),
    campaign: {
      ...args.generation.campaign,
      shortFormHooks: hooks.slice(0, 12),
    },
  };
}
