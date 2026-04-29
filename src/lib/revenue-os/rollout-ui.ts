/**
 * UI-ready payloads for policy rollout workbench (cards, tables, stages).
 */

import type { BentleyRolloutCoachingResult } from "@/lib/revenue-os/rollout-coaching";
import type { BentleyRolloutSimulationResult } from "@/lib/revenue-os/rollout-simulation";

export function buildRolloutStageCards(coaching: BentleyRolloutCoachingResult) {
  return coaching.rolloutStages.map((s) => ({
    id: s.id,
    title: s.title,
    body: s.description,
    gate: s.gate,
  }));
}

export function buildPilotWorkspaceTable(coaching: BentleyRolloutCoachingResult) {
  return coaching.recommendedPilotWorkspaces.map((w) => ({
    clientId: w.clientId,
    trustId: w.trustId,
    label: w.label,
    rationale: w.rationale,
  }));
}

export function buildAvoidWorkspaceTable(coaching: BentleyRolloutCoachingResult) {
  return coaching.recommendedAvoidWorkspaces.map((w) => ({
    clientId: w.clientId,
    trustId: w.trustId,
    label: w.label,
    rationale: w.rationale,
  }));
}

export function buildRolloutSummaryBanner(coaching: BentleyRolloutCoachingResult) {
  return {
    title: "Rollout plan (coaching)",
    body: coaching.rolloutSummary,
    preset: coaching.strategyPreset,
  };
}

export function buildSuccessMetricChecklist(coaching: BentleyRolloutCoachingResult) {
  return coaching.successSignals.map((text, i) => ({ id: `sig_${i + 1}`, text, checked: false }));
}

export function buildOperatorWarningBanners(coaching: BentleyRolloutCoachingResult) {
  return coaching.operatorWarnings.slice(0, 12).map((w, i) => ({ id: `warn_${i}`, message: w }));
}

export function buildSimulatedStageCards(simulation: BentleyRolloutSimulationResult) {
  return simulation.stages.map((s) => ({
    id: s.stageId,
    title: s.title,
    workspaceCount: s.workspacesIncluded.length,
    maxAllowed: s.maxAllowed,
    risk: s.estimatedRiskConcentration,
    blockers: s.blockerHints,
    workspaces: s.workspacesIncluded,
  }));
}

export function buildRolloutSimulationSummary(simulation: BentleyRolloutSimulationResult) {
  return {
    impact: simulation.policyImpactSpreadEstimate,
    risk: simulation.operationalRiskConcentration,
    clusters: simulation.blockerClusters,
    dryRun: simulation.dryRun,
  };
}
