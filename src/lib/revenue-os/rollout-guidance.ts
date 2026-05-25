/**
 * Maps rollout coaching + monitoring into `GrowthGuidance` overlay fields.
 */

import type { GrowthGuidance } from "@/lib/revenue-os/market-sweep-schema";
import type { BentleyRolloutCoachingResult } from "@/lib/revenue-os/rollout-coaching";
import {
  buildRolloutMonitoringGuidanceLines,
  type BentleyRolloutMonitoringResult,
} from "@/lib/revenue-os/rollout-monitoring";

function emptyGrowthGuidance(): GrowthGuidance {
  return {
    recommendedNextMove: "",
    why: "",
    risingTopics: [],
    weakAngles: [],
    bestHookDirection: "",
  };
}

export function buildRolloutGuidanceLines(coaching: BentleyRolloutCoachingResult): Partial<GrowthGuidance> {
  const pilot = coaching.recommendedPilotWorkspaces[0];
  return {
    bentleyRolloutSummaryLine: coaching.rolloutSummary.slice(0, 420),
    bentleyPilotWorkspaceRecommendationLine: pilot
      ? `${pilot.label}: ${pilot.rationale}`.slice(0, 420)
      : undefined,
    bentleyRolloutRiskLine: `${coaching.riskAssessment.level} — ${coaching.riskAssessment.rationale}`.slice(0, 420),
    bentleyRollbackTriggerLine: coaching.rollbackTriggers[0]?.slice(0, 420),
  };
}

export function mergeRolloutGuidanceIntoGrowthGuidance(
  base: GrowthGuidance | null,
  lines: Partial<GrowthGuidance>
): GrowthGuidance {
  return { ...emptyGrowthGuidance(), ...(base ?? {}), ...lines };
}

export function mergeRolloutMonitoringGuidanceIntoGrowthGuidance(
  base: GrowthGuidance | null,
  monitoring: BentleyRolloutMonitoringResult | null
): GrowthGuidance {
  const extra = monitoring ? buildRolloutMonitoringGuidanceLines(monitoring) : {};
  return mergeRolloutGuidanceIntoGrowthGuidance(base, extra);
}
