/**
 * UI-ready payloads for multi-scenario comparison (tables, badges, matrix).
 */

import type {
  BentleyScenarioCompareResult,
  BentleyScenarioMetrics,
  RichScenarioCompareRow,
} from "@/lib/revenue-os/scenario-compare";

export function buildRankedScenarioTable(result: BentleyScenarioCompareResult): {
  columns: string[];
  rows: Array<Record<string, string | number | null>>;
} {
  return {
    columns: ["rank", "name", "type", "auto+", "auto−", "appr+", "appr−", "risk", "notes"],
    rows: result.rankedScenarios.map((m, i) => ({
      rank: i + 1,
      name: m.name,
      type: m.scenarioType,
      "auto+": m.addedAutoActions,
      "auto−": m.removedAutoActions,
      "appr+": m.addedApprovals,
      "appr−": m.reducedApprovals,
      risk: m.increasedRiskFlags,
      notes: m.raw?.summaryDelta?.slice(0, 120) ?? "—",
    })),
  };
}

export function buildSafestBadge(scenario: BentleyScenarioMetrics | null): { label: string; scenarioId: string | null } {
  if (!scenario) return { label: "Safest — n/a", scenarioId: null };
  return { label: `Safest: ${scenario.name}`, scenarioId: scenario.id };
}

export function buildHighestUpsideBadge(scenario: BentleyScenarioMetrics | null): { label: string; scenarioId: string | null } {
  if (!scenario) return { label: "Highest upside — n/a", scenarioId: null };
  return { label: `Highest upside: ${scenario.name}`, scenarioId: scenario.id };
}

export function buildBalancedRecommendationCallout(result: BentleyScenarioCompareResult): { title: string; body: string } {
  return {
    title: "Balanced recommendation",
    body: result.balancedRecommendation.rationale,
  };
}

export function buildComparisonMatrixPayload(result: BentleyScenarioCompareResult): {
  matrix: typeof result.comparisonMatrix;
  headline: string;
} {
  return {
    matrix: result.comparisonMatrix,
    headline: "Scenario comparison (dry-run outputs)",
  };
}

/** Rich matrix for client rendering — includes per-cell highlight hints. */
export function buildRichScenarioCompareMatrixPayload(result: BentleyScenarioCompareResult): {
  headline: string;
  columns: Array<{ id: string; label: string; hint?: string }>;
  rows: RichScenarioCompareRow[];
  badges: {
    safest: ReturnType<typeof buildSafestBadge>;
    highestUpside: ReturnType<typeof buildHighestUpsideBadge>;
    balanced: ReturnType<typeof buildBalancedRecommendationCallout>;
  };
  meta: { pairedScenarioMode: boolean; recommendationPreset: string | null };
} {
  return {
    headline: "Scenario comparison matrix",
    columns: [
      { id: "name", label: "Scenario" },
      { id: "scenarioType", label: "Type" },
      { id: "riskLevel", label: "Risk" },
      { id: "addedAutoActions", label: "Auto +" },
      { id: "removedAutoActions", label: "Auto −" },
      { id: "addedApprovals", label: "Appr +" },
      { id: "removedApprovals", label: "Appr −" },
      { id: "changedNotifications", label: "Δ notifications" },
      { id: "changedQueueStates", label: "Δ queue" },
      { id: "handoffVolumeDelta", label: "Δ handoff" },
      { id: "recommendationNote", label: "Note" },
    ],
    rows: result.richRows,
    badges: {
      safest: buildSafestBadge(result.safestScenario),
      highestUpside: buildHighestUpsideBadge(result.highestUpsideScenario),
      balanced: buildBalancedRecommendationCallout(result),
    },
    meta: {
      pairedScenarioMode: result.pairedScenarioMode,
      recommendationPreset: result.recommendationPreset,
    },
  };
}

export function highlightClassForCell(h: "best" | "worst" | "neutral"): string {
  if (h === "best") return "bg-emerald-500/15 text-emerald-100";
  if (h === "worst") return "bg-rose-500/15 text-rose-100";
  return "text-zinc-300";
}
