/**
 * Builds a compact structured experiment plan from sweep + feedback + diff signals.
 */

import type {
  ContentGenerationMode,
  GrowthGuidance,
  MarketIntelligenceDiff,
  MarketSweepExperimentPlan,
  MarketSweepNextAction,
  MarketSweepResult,
  ExperimentPlanVariant,
} from "@/lib/revenue-os/market-sweep-schema";

export type PlanBentleyExperimentInput = {
  nextAction: MarketSweepNextAction;
  contentGenerationMode: ContentGenerationMode;
  growthGuidance: GrowthGuidance;
  topPerformingTopics: string[];
  underperformingTopics: string[];
  topPerformingHookTypes: string[];
  marketIntelligenceDiff: MarketIntelligenceDiff | null;
  hybrid: MarketSweepResult;
  /** Preferred platforms from intake / sweep */
  defaultPlatforms: string[];
};

export type PlanBentleyExperimentOutput = {
  plan: MarketSweepExperimentPlan | null;
  skippedReason?: string;
};

function pickPrimaryMetric(mode: ContentGenerationMode, nextAction: string): string {
  if (mode === "scale_winners" || nextAction === "double_down_content") return "conversion_or_lead_rate";
  if (mode === "iterate_messaging") return "engagement_and_comment_quality";
  if (mode === "research_first") return "save_rate_and_watch_time";
  return "engagement_rate";
}

function hasMinimumSignal(h: MarketSweepResult): boolean {
  const real = h.hybridMeta?.realSignalCount ?? 0;
  const topics = (h.trendingTopics ?? []).length + (h.viralHooks ?? []).length;
  return real >= 2 || topics >= 5;
}

function buildHypothesis(
  mode: ContentGenerationMode,
  gg: GrowthGuidance,
  diff: MarketIntelligenceDiff | null
): string {
  const rising = gg.risingTopics?.[0] ?? "core offer themes";
  if (mode === "iterate_messaging") {
    return `Changing hook framing and CTA while holding topic "${rising}" constant will improve engagement vs prior underperforming angles.`;
  }
  if (mode === "scale_winners") {
    return `Doubling down on "${rising}" with the strongest hook types from feedback will outperform exploratory angles.`;
  }
  if (diff?.newTopics?.length) {
    return `New themes (${diff.newTopics.slice(0, 2).join(", ")}) will resonate more than cooled topics when paired with distinct CTAs.`;
  }
  return `Systematic variation in hook structure and CTA type around "${rising}" will reveal the highest-resonance combination.`;
}

function themeFromGuidance(gg: GrowthGuidance, industryHint: string): string {
  const t = gg.risingTopics?.[0] ?? industryHint.slice(0, 80);
  return `Validate messaging for: ${t}`;
}

function recommendedPlatforms(input: PlanBentleyExperimentInput): string[] {
  const fromSweep = input.defaultPlatforms.length
    ? input.defaultPlatforms
    : input.hybrid.trendingTopics.some((x) => /tiktok|short/i.test(x))
      ? ["TikTok", "Instagram"]
      : ["Instagram", "LinkedIn"];
  return [...new Set(fromSweep.map((x) => x.trim()).filter(Boolean))].slice(0, 4);
}

/**
 * Produces 3–5 intentional variants (hook, angle, CTA, framing) that are deliberately different.
 */
export function planBentleyExperiment(input: PlanBentleyExperimentInput): PlanBentleyExperimentOutput {
  const { hybrid, growthGuidance, marketIntelligenceDiff, contentGenerationMode, nextAction } = input;

  if (!hasMinimumSignal(hybrid)) {
    return {
      plan: null,
      skippedReason: "Insufficient sweep signal — need more live connector lines or fuller topic buckets before running experiments.",
    };
  }

  const industryHint =
    hybrid.trendingTopics[0] ?? hybrid.commentInsights[0] ?? hybrid.painPoints[0] ?? "your market";
  const platforms = recommendedPlatforms(input);
  const primaryPlatform = platforms[0] ?? "Instagram";
  const secondaryPlatform = platforms[1] ?? primaryPlatform;

  const hypothesis = buildHypothesis(contentGenerationMode, growthGuidance, marketIntelligenceDiff);
  const experimentTheme = themeFromGuidance(growthGuidance, industryHint);
  const primaryMetric = pickPrimaryMetric(contentGenerationMode, nextAction.action);

  const weak = input.underperformingTopics[0] ?? growthGuidance.weakAngles?.[0] ?? "generic thought leadership";
  const strongHook = input.topPerformingHookTypes[0] ?? "pov";
  const rising = growthGuidance.risingTopics?.[0] ?? hybrid.trendingTopics[0] ?? industryHint;

  const variants: ExperimentPlanVariant[] = [
    {
      variantKey: "A",
      hookType: "contrarian",
      angle: `Challenge the default advice in ${rising} — name the hidden cost.`,
      ctaType: "comment_debate",
      framingStyle: "provocative_short_form",
      platform: primaryPlatform,
      contentType: "Short video / Reel",
    },
    {
      variantKey: "B",
      hookType: strongHook === "pov" ? "pov" : "story",
      angle: `POV: ${industryHint.slice(0, 60)} — show the before/after in one scene.`,
      ctaType: "save_and_follow",
      framingStyle: "authentic_ugc",
      platform: primaryPlatform,
      contentType: "Short video / Reel",
    },
    {
      variantKey: "C",
      hookType: "listicle",
      angle: `3 mistakes teams make around ${rising} (avoid ${weak.slice(0, 40)}).`,
      ctaType: "dm_keyword",
      framingStyle: "educational_authority",
      platform: secondaryPlatform,
      contentType: "Carousel / thread",
    },
    {
      variantKey: "D",
      hookType: "social_proof",
      angle: `What changed after switching strategy on ${rising} — evidence-led.`,
      ctaType: "book_call",
      framingStyle: "case_study",
      platform: secondaryPlatform,
      contentType: "Long caption + short clip",
    },
    {
      variantKey: "E",
      hookType: "curiosity_gap",
      angle: `The one line that reframes ${rising} for skeptical buyers.`,
      ctaType: "link_in_bio",
      framingStyle: "minimal_premium",
      platform: primaryPlatform,
      contentType: "Short video / Reel",
    },
  ];

  return {
    plan: {
      hypothesis,
      experimentTheme,
      primaryMetric,
      recommendedPlatforms: platforms,
      variants: variants.slice(0, 5),
    },
  };
}
