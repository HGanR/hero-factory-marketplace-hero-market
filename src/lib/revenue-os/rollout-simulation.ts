/**
 * Dry-run simulation of how a rollout strategy would slice workspaces — no live mutations.
 */

import type { OperatorWorkspaceSummary } from "@/lib/revenue-os/operator-types";
import { scoreWorkspaceForBentleyRollout } from "@/lib/revenue-os/workspace-rollout-suitability";
import type { BentleyRolloutStrategyJson, RolloutStrategyPreset } from "@/lib/revenue-os/rollout-strategies";
import { rolloutStrategyByPreset } from "@/lib/revenue-os/rollout-strategies";

export type BentleyRolloutSimulationStage = {
  stageId: string;
  title: string;
  workspacesIncluded: Array<{ clientId: string; trustId: string; label: string; suitabilityScore: number; band: string }>;
  maxAllowed: number;
  estimatedRiskConcentration: "low" | "medium" | "high";
  blockerHints: string[];
};

export type BentleyRolloutSimulationResult = {
  dryRun: true;
  stages: BentleyRolloutSimulationStage[];
  policyImpactSpreadEstimate: string;
  operationalRiskConcentration: string;
  blockerClusters: string[];
};

export type SimulateBentleyRolloutPlanInput = {
  workspaceSummaries: OperatorWorkspaceSummary[];
  strategyPreset?: RolloutStrategyPreset;
  /** Override preset JSON when simulating a saved plan. */
  strategyJson?: BentleyRolloutStrategyJson | null;
};

/**
 * Assigns pilot-suitable workspaces to each stage up to per-stage caps. Pure dry-run.
 */
export function simulateBentleyRolloutPlan(input: SimulateBentleyRolloutPlanInput): BentleyRolloutSimulationResult {
  const strategy = input.strategyJson ?? rolloutStrategyByPreset(input.strategyPreset ?? "balanced");
  const ranked = [...input.workspaceSummaries]
    .map((w) => ({ ws: w, s: scoreWorkspaceForBentleyRollout(w) }))
    .sort((a, b) => b.s.score - a.s.score);

  const pilotsPreferred = ranked.filter((r) => r.s.band === "strong_pilot" || r.s.band === "acceptable_pilot");
  const pool = pilotsPreferred.length ? pilotsPreferred : ranked;

  const stages: BentleyRolloutSimulationStage[] = [];
  let cursor = 0;
  for (let i = 0; i < strategy.scopeProgression.length; i++) {
    const max = Math.min(strategy.maxWorkspacesPerStage[i] ?? 1, pool.length - cursor);
    const slice = max > 0 ? pool.slice(cursor, cursor + max) : [];
    cursor += slice.length;

    const failedInSlice = slice.reduce((a, x) => a + x.ws.failedCount, 0);
    const blockedInSlice = slice.reduce((a, x) => a + x.ws.blockedConnectorTargets, 0);
    const estRisk: "low" | "medium" | "high" =
      failedInSlice >= 3 || blockedInSlice >= 4 ? "high" : failedInSlice >= 1 || blockedInSlice >= 2 ? "medium" : "low";

    const blockerHints: string[] = [];
    if (blockedInSlice > 0) blockerHints.push(`${blockedInSlice} blocked routing target(s) in this stage.`);
    if (failedInSlice > 0) blockerHints.push(`${failedInSlice} publish failure(s) in this stage's workspaces.`);

    stages.push({
      stageId: `sim_${i + 1}`,
      title: strategy.scopeProgression[i] ?? `stage_${i + 1}`,
      workspacesIncluded: slice.map((x) => ({
        clientId: x.ws.workspace.clientId ?? "",
        trustId: x.ws.workspace.trustId ?? "",
        label: `${x.ws.workspace.clientId || "default"}/${x.ws.workspace.trustId || "default"}`,
        suitabilityScore: x.s.score,
        band: x.s.band,
      })),
      maxAllowed: strategy.maxWorkspacesPerStage[i] ?? 1,
      estimatedRiskConcentration: estRisk,
      blockerHints,
    });
  }

  const totalQueued = input.workspaceSummaries.reduce((a, w) => a + w.draftCount + w.staleBacklogCount, 0);
  const policyImpactSpreadEstimate =
    input.workspaceSummaries.length === 0
      ? "No workspaces — impact spread is zero until scope is widened."
      : `Estimated policy touch surface scales with queue depth (~${totalQueued} draft/stale items aggregate) across ${input.workspaceSummaries.length} workspace(s).`;

  const anyHigh = stages.some((s) => s.estimatedRiskConcentration === "high");
  const operationalRiskConcentration = anyHigh
    ? "High concentration risk in at least one stage — shrink stage size or fix publishing/routing first."
    : stages.some((s) => s.estimatedRiskConcentration === "medium")
      ? "Medium — monitor failures and blocked targets closely between stages."
      : "Low concentration — still validate with live metrics during observation windows.";

  const blockerClusters: string[] = [];
  const highFailed = input.workspaceSummaries.filter((w) => w.failedCount >= 2);
  if (highFailed.length) {
    blockerClusters.push(`${highFailed.length} workspace(s) show repeated publish failures — cluster outside early stages.`);
  }
  const blockedHeavy = input.workspaceSummaries.filter((w) => w.blockedConnectorTargets >= 3);
  if (blockedHeavy.length) {
    blockerClusters.push(`${blockedHeavy.length} workspace(s) with heavy connector blocks — avoid until OAuth/routing fixed.`);
  }

  return {
    dryRun: true,
    stages,
    policyImpactSpreadEstimate,
    operationalRiskConcentration,
    blockerClusters,
  };
}
