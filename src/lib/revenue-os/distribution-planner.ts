/**
 * Maps experiment outcomes + sweep guidance into launch / test / hold distribution buckets.
 */

import type {
  ContentGenerationMode,
  GrowthGuidance,
  MarketSweepExperimentPlan,
  MarketSweepNextAction,
  DistributionPlanItem,
  BentleyDistributionPlan,
} from "@/lib/revenue-os/market-sweep-schema";
import type { ExperimentPerformanceAnalysis } from "@/lib/revenue-os/experiment-analysis";

export type { DistributionPlanItem, BentleyDistributionPlan };

export type PlanBentleyDistributionInput = {
  experimentPlan: MarketSweepExperimentPlan | null;
  experimentAnalysis: ExperimentPerformanceAnalysis | null;
  nextAction: MarketSweepNextAction;
  contentGenerationMode: ContentGenerationMode;
  growthGuidance: GrowthGuidance;
  winningVariants: string[];
  recommendedPlatforms: string[];
  topPerformingHookTypes: string[];
};

function clampPriority(n: number): number {
  return Math.max(1, Math.min(10, Math.round(n)));
}

function defaultFormatForPlatform(platform: string, contentType: string): string {
  const p = platform.toLowerCase();
  if (/linkedin/.test(p)) return /carousel|thread/i.test(contentType) ? "document_carousel" : "text_post";
  if (/tiktok|reel|short/i.test(p) || /short/i.test(contentType)) return "short_video_vertical";
  if (/instagram/.test(p)) return /carousel/i.test(contentType) ? "carousel" : "reel_or_feed";
  if (/youtube/.test(p)) return "shorts_or_long";
  return "feed_post";
}

/**
 * Chooses which variants ship first, assigns priority, and maps platform → format.
 */
export function planBentleyDistribution(input: PlanBentleyDistributionInput): BentleyDistributionPlan {
  const variants = input.experimentPlan?.variants ?? [];
  const platforms =
    input.recommendedPlatforms.length > 0
      ? input.recommendedPlatforms
      : variants.length
        ? [...new Set(variants.map((v) => v.platform).filter(Boolean))]
        : ["Instagram"];

  const primaryPlatform = platforms[0] ?? "Instagram";
  const secondaryPlatform = platforms[1] ?? primaryPlatform;

  const winOrder = new Set<string>([
    ...input.winningVariants,
    ...(input.experimentAnalysis?.winningVariants ?? []),
  ]);
  const loseOrder = new Set(input.experimentAnalysis?.losingVariants ?? []);

  const ranked = [...variants].sort((a, b) => {
    const aw = winOrder.has(a.variantKey) ? 1 : 0;
    const bw = winOrder.has(b.variantKey) ? 1 : 0;
    if (aw !== bw) return bw - aw;
    const al = loseOrder.has(a.variantKey) ? 1 : 0;
    const bl = loseOrder.has(b.variantKey) ? 1 : 0;
    if (al !== bl) return al - bl;
    return a.variantKey.localeCompare(b.variantKey);
  });

  const scaleMode =
    input.contentGenerationMode === "scale_winners" || input.nextAction.action === "double_down_content";
  const iterateMode = input.contentGenerationMode === "iterate_messaging" || input.nextAction.action === "iterate_messaging";

  const launchCount = scaleMode ? Math.min(2, Math.max(1, ranked.length ? 2 : 0)) : iterateMode ? 1 : Math.min(2, ranked.length || 0);
  const testCount = ranked.length > launchCount ? Math.min(3, ranked.length - launchCount) : 0;

  const launchNow: DistributionPlanItem[] = [];
  const testNext: DistributionPlanItem[] = [];
  const holdBack: DistributionPlanItem[] = [];

  let basePri = scaleMode ? 9 : iterateMode ? 6 : 7;

  for (let i = 0; i < ranked.length; i++) {
    const v = ranked[i];
    const plat = v.platform || (i % 2 === 0 ? primaryPlatform : secondaryPlatform);
    const fmt = defaultFormatForPlatform(plat, v.contentType);
    const item: DistributionPlanItem = {
      variantKey: v.variantKey,
      platform: plat,
      contentType: v.contentType,
      publishPriority: clampPriority(basePri - Math.min(i, 3)),
      hookType: v.hookType,
      angle: v.angle.slice(0, 500),
      ctaType: v.ctaType,
      targetFormat: fmt,
      rationale:
        winOrder.has(v.variantKey)
          ? "Backed by winning experiment cell or hook signal."
          : loseOrder.has(v.variantKey)
            ? "Lower observed performance — keep in reserve or rework."
            : "Balanced exploratory slot from experiment plan.",
    };

    if (i < launchCount) launchNow.push(item);
    else if (i < launchCount + testCount) testNext.push(item);
    else holdBack.push(item);
  }

  if (!ranked.length && input.topPerformingHookTypes.length) {
    const h = input.topPerformingHookTypes[0];
    launchNow.push({
      variantKey: "A",
      platform: primaryPlatform,
      contentType: "Short video / Reel",
      publishPriority: 8,
      hookType: h,
      angle: input.growthGuidance.risingTopics[0] ?? "Lead with strongest feedback-backed hook pattern.",
      ctaType: "comment_intent",
      targetFormat: defaultFormatForPlatform(primaryPlatform, "Short video / Reel"),
      rationale: "No structured experiment variants — using top-performing hook type from feedback.",
    });
  }

  const platformFormatHints = platforms.slice(0, 4).map((platform, i) => ({
    platform,
    format: defaultFormatForPlatform(platform, variants[i]?.contentType ?? ""),
    reason:
      i === 0
        ? "Primary channel from sweep / experiment recommendation."
        : "Secondary channel for cross-post or format test.",
  }));

  const summary = [
    `Mode: ${input.contentGenerationMode} (${input.nextAction.action}).`,
    launchNow.length ? `Launch now: ${launchNow.map((x) => x.variantKey).join(", ")}.` : "Launch now: (none — add experiment variants).",
    testNext.length ? `Test next: ${testNext.map((x) => x.variantKey).join(", ")}.` : "",
    holdBack.length ? `Hold back: ${holdBack.map((x) => x.variantKey).join(", ")}.` : "",
    input.growthGuidance.bestHookDirection ? `Hook direction: ${input.growthGuidance.bestHookDirection.slice(0, 160)}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    summary: summary.slice(0, 2000),
    launchNow,
    testNext,
    holdBack,
    platformFormatHints,
  };
}
