export type ExperimentSummaryForAnalysis = {
  variants: Array<{
    variantKey: string;
    hookType: string;
    angle: string;
    ctaType: string;
    score: number;
    views: number;
    leads: number;
  }>;
  experimentTheme: string | null;
};

export type ExperimentPerformanceAnalysis = {
  winningVariants: string[];
  losingVariants: string[];
  winningHookTypes: string[];
  winningAngles: string[];
  weakCTAs: string[];
  recommendedNextPromotion: string;
  recommendedNextSuppression: string;
  confidenceNote: string;
};

/**
 * Derives winners/losers and qualitative recommendations from aggregated variant metrics.
 * Degrades gracefully when sample sizes are tiny or metrics are sparse.
 */
export function analyzeExperimentPerformance(summary: ExperimentSummaryForAnalysis | null): ExperimentPerformanceAnalysis {
  if (!summary?.variants?.length) {
    return {
      winningVariants: [],
      losingVariants: [],
      winningHookTypes: [],
      winningAngles: [],
      weakCTAs: [],
      recommendedNextPromotion: "Run experiments and record results per variant to unlock recommendations.",
      recommendedNextSuppression: "—",
      confidenceNote: "No variant performance data yet.",
    };
  }

  const v = summary.variants;
  const hasSignal = v.some((x) => x.score !== 0 || x.views > 0 || x.leads > 0);
  if (!hasSignal || v.length < 2) {
    return {
      winningVariants: [v[0]?.variantKey ?? "A"],
      losingVariants: [],
      winningHookTypes: v[0]?.hookType ? [v[0].hookType] : [],
      winningAngles: v[0]?.angle ? [v[0].angle] : [],
      weakCTAs: [],
      recommendedNextPromotion: "Collect impressions or engagement metrics to separate winners from noise.",
      recommendedNextSuppression: "—",
      confidenceNote: "Sparse metrics — rankings are provisional.",
    };
  }

  const top = v[0];
  const bottom = v[v.length - 1];
  const winningVariants = top.score > bottom.score ? [top.variantKey] : [top.variantKey];
  const losingVariants = top.score > bottom.score && bottom.score < top.score ? [bottom.variantKey] : [];

  const winningHookTypes = top.hookType ? [top.hookType] : [];
  const winningAngles = top.angle ? [top.angle.slice(0, 200)] : [];
  const weakCTAs = bottom.ctaType && top.ctaType !== bottom.ctaType ? [bottom.ctaType] : [];

  const n = v.length;
  const confidenceNote =
    n < 4
      ? `Only ${n} variant(s) — confirm with more traffic before scaling.`
      : "Moderate sample — use promotion/suppression as directional guidance.";

  return {
    winningVariants,
    losingVariants,
    winningHookTypes,
    winningAngles,
    weakCTAs,
    recommendedNextPromotion: top.hookType
      ? `Scale ${top.hookType} hooks with angles similar to: ${top.angle.slice(0, 120)}…`
      : "Promote the top-scoring variant's creative formula across the next content batch.",
    recommendedNextSuppression: bottom.angle
      ? `Reduce spend on ${bottom.ctaType} CTAs paired with: ${bottom.angle.slice(0, 100)}…`
      : "Pause the lowest-scoring variant until messaging is revised.",
    confidenceNote,
  };
}
