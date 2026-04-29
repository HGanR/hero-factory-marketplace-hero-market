/**
 * Re-test recommendations when uncertainty, drift, or new signals warrant another cell.
 */

import type { ExperimentPerformanceAnalysis } from "@/lib/revenue-os/experiment-analysis";
import type { MarketIntelligenceDiff } from "@/lib/revenue-os/market-sweep-schema";
import type { GrowthGuidance } from "@/lib/revenue-os/market-sweep-schema";
import type { LeadSignalSummary } from "@/lib/revenue-os/lead-signal-summary";
import type { ConnectorCoverageSummary } from "@/lib/revenue-os/distribution-routing";

export type BentleyRetestRecommendation = {
  id: string;
  hookType: string;
  angle: string;
  ctaType: string;
  platform: string;
  rationale: string;
  priority: number;
};

export type PlanBentleyRetestsInput = {
  experimentAnalysis: ExperimentPerformanceAnalysis | null;
  intelligenceDiff: MarketIntelligenceDiff | null | undefined;
  growthGuidance: GrowthGuidance | null | undefined;
  leadSignalSummary: LeadSignalSummary | null | undefined;
  connectorCoverage: ConnectorCoverageSummary | null | undefined;
  /** Platforms to bias toward when connectors newly appear. */
  platformsHint: string[];
};

let retestSeq = 0;

export function planBentleyRetests(input: PlanBentleyRetestsInput): BentleyRetestRecommendation[] {
  const out: BentleyRetestRecommendation[] = [];
  const a = input.experimentAnalysis;
  const diff = input.intelligenceDiff;
  const gg = input.growthGuidance;
  const ls = input.leadSignalSummary;
  const cc = input.connectorCoverage;

  if (a?.confidenceNote.includes("Sparse") || a?.confidenceNote.includes("provisional")) {
    const hook = a.winningHookTypes[0] ?? "pov";
    const angle = a.winningAngles[0] ?? gg?.bestHookDirection ?? "Validate core pain with a fresh proof point.";
    const cta = a.weakCTAs[0] ?? "comment";
    retestSeq++;
    out.push({
      id: `retest-sparse-${retestSeq}`,
      hookType: hook,
      angle: angle.slice(0, 200),
      ctaType: cta,
      platform: input.platformsHint[0] ?? "instagram",
      rationale:
        "Performance data is sparse — re-run the same strategic cell with one controlled variable change (hook or CTA).",
      priority: 7,
    });
  }

  if (diff?.hasPrior && (diff.newTopics.length > 0 || diff.strengthenedHooks.length > 0)) {
    retestSeq++;
    out.push({
      id: `retest-diff-${retestSeq}`,
      hookType: "trend_bridge",
      angle: `Bridge to new themes: ${diff.newTopics.slice(0, 2).join("; ") || diff.summary}`.slice(0, 200),
      ctaType: "soft_cta",
      platform: input.platformsHint[0] ?? "tiktok",
      rationale: "Market intelligence shifted — retest prior winner against emerging topics.",
      priority: 6,
    });
  }

  if (ls && ls.objectionClusters.length > 0 && ls.highIntentSignals < ls.objectionClusters.length) {
    retestSeq++;
    out.push({
      id: `retest-objection-${retestSeq}`,
      hookType: "objection_handler",
      angle: `Address objections: ${ls.objectionClusters[0]?.slice(0, 120) ?? "proof"}`,
      ctaType: "dm",
      platform: input.platformsHint[0] ?? "linkedin",
      rationale: "Objection-heavy intent — retest testimonial or proof-forward creative.",
      priority: 8,
    });
  }

  if (cc && cc.manualFallbackCount > 0 && cc.connectedPlatforms.length > 0) {
    retestSeq++;
    out.push({
      id: `retest-connector-${retestSeq}`,
      hookType: "evergreen",
      angle: "Stable evergreen line that works in manual export while OAuth expands.",
      ctaType: "link",
      platform: cc.connectedPlatforms[0] ?? "instagram",
      rationale: "Connector coverage improved — retest a previously manual-only platform cell.",
      priority: 5,
    });
  }

  return out.slice(0, 8);
}
