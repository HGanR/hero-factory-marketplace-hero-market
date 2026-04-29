/**
 * Operator coaching for staged policy rollout — wraps operator overview + scenario signals.
 */

import type { BentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import type { BentleyScenarioCompareResult } from "@/lib/revenue-os/scenario-compare";
import { detectBentleyExceptions, type DetectBentleyExceptionsResult } from "@/lib/revenue-os/exception-detection";
import { scoreWorkspaceForBentleyRollout } from "@/lib/revenue-os/workspace-rollout-suitability";
import { rolloutStrategyByPreset, type RolloutStrategyPreset } from "@/lib/revenue-os/rollout-strategies";

export type BentleyRolloutWorkspaceRef = {
  clientId: string;
  trustId: string;
  label: string;
  rationale: string;
};

export type BentleyRolloutStage = {
  id: string;
  title: string;
  description: string;
  gate: string;
};

export type BentleyRolloutCoachingResult = {
  recommendedPilotWorkspaces: BentleyRolloutWorkspaceRef[];
  recommendedAvoidWorkspaces: BentleyRolloutWorkspaceRef[];
  rolloutStages: BentleyRolloutStage[];
  rolloutSummary: string;
  riskAssessment: { level: "low" | "medium" | "high"; rationale: string };
  rollbackTriggers: string[];
  successSignals: string[];
  operatorWarnings: string[];
  strategyPreset: RolloutStrategyPreset;
};

export type BuildBentleyRolloutCoachingInput = {
  overview: BentleyOperatorOverview;
  scenarioCompare?: BentleyScenarioCompareResult | null;
  strategyPreset?: RolloutStrategyPreset;
  /** Optional — pending autonomous approvals (from dashboard) when available. */
  autonomousApprovalPendingCount?: number | null;
};

function workspaceLabel(clientId: string, trustId: string): string {
  const c = clientId?.trim() || "default";
  const t = trustId?.trim() || "default";
  return `${c} / ${t}`;
}

function riskLevelFromSignals(input: {
  ex: DetectBentleyExceptionsResult;
  overview: BentleyOperatorOverview;
  scenarioCompare?: BentleyScenarioCompareResult | null;
}): { level: "low" | "medium" | "high"; rationale: string } {
  const crit = input.ex.criticalExceptions.length;
  const warn = input.ex.warningExceptions.length;
  const hp = input.overview.globalSummary.totalFailedPublishes;
  const riskFlags =
    input.scenarioCompare?.safestScenario && input.scenarioCompare.highestUpsideScenario
      ? input.scenarioCompare.safestScenario.id !== input.scenarioCompare.highestUpsideScenario.id
      : false;

  if (crit >= 2 || hp >= 5) {
    return {
      level: "high",
      rationale: "Elevated operational risk from exceptions and/or publish failures — narrow pilots and extend observation.",
    };
  }
  if (crit >= 1 || warn >= 4 || hp >= 2 || riskFlags) {
    return {
      level: "medium",
      rationale: "Mixed signals — use staged rollout with explicit rollback triggers and success checks.",
    };
  }
  return {
    level: "low",
    rationale: "Baseline stability is acceptable for a measured rollout if pilots stay small.",
  };
}

export function buildBentleyRolloutCoaching(input: BuildBentleyRolloutCoachingInput): BentleyRolloutCoachingResult {
  const preset = input.strategyPreset ?? "balanced";
  const strategy = rolloutStrategyByPreset(preset);
  const ex = detectBentleyExceptions({ overview: input.overview });
  const ws = input.overview.workspaceSummaries;
  const scored = ws.map(scoreWorkspaceForBentleyRollout);

  const strong = scored.filter((s) => s.band === "strong_pilot").sort((a, b) => b.score - a.score);
  const acceptable = scored.filter((s) => s.band === "acceptable_pilot").sort((a, b) => b.score - a.score);
  const risky = scored
    .filter((s) => s.band === "risky_for_rollout" || s.band === "avoid_for_now")
    .sort((a, b) => a.score - b.score);

  const recommendedPilotWorkspaces: BentleyRolloutWorkspaceRef[] = [...strong, ...acceptable].slice(0, 8).map((s) => ({
    clientId: s.clientId,
    trustId: s.trustId,
    label: workspaceLabel(s.clientId, s.trustId),
    rationale: [s.rationale, s.factors[0]].filter(Boolean).join(" ").slice(0, 400),
  }));

  const recommendedAvoidWorkspaces: BentleyRolloutWorkspaceRef[] = risky.slice(0, 8).map((s) => ({
    clientId: s.clientId,
    trustId: s.trustId,
    label: workspaceLabel(s.clientId, s.trustId),
    rationale: [s.rationale, s.factors[0]].filter(Boolean).join(" ").slice(0, 400),
  }));

  const rolloutStages: BentleyRolloutStage[] = strategy.scopeProgression.map((title, i) => ({
    id: `stage_${i + 1}`,
    title,
    description: `Include up to ${strategy.maxWorkspacesPerStage[i] ?? 1} workspace(s); observe ${strategy.observationWindowHours}h before advancing.`,
    gate: strategy.requiredSuccessSignals[Math.min(i, strategy.requiredSuccessSignals.length - 1)] ?? "Confirm metrics",
  }));

  const riskAssessment = riskLevelFromSignals({
    ex,
    overview: input.overview,
    scenarioCompare: input.scenarioCompare ?? null,
  });

  const rt = strategy.rollbackThresholds;
  const rollbackTriggers: string[] = [
    rt.failedPublishSpike != null ? `Rollback if failed publishes spike by ≥${rt.failedPublishSpike} vs baseline.` : "",
    rt.approvalBacklogDelta != null
      ? `Rollback if autonomous approval backlog grows by ≥${rt.approvalBacklogDelta} without clearing.`
      : "",
    rt.criticalExceptionCount != null
      ? `Rollback if critical exceptions ≥${rt.criticalExceptionCount} attributed to the change window.`
      : "",
  ].filter(Boolean);

  if (input.autonomousApprovalPendingCount != null && input.autonomousApprovalPendingCount > 10) {
    rollbackTriggers.push("Pause expansion if pending autonomous approvals stay elevated (>10) through the observation window.");
  }

  const operatorWarnings: string[] = [
    ...ex.criticalExceptions.map((e) => `[critical] ${e.message}`),
    ...ex.warningExceptions.slice(0, 6).map((e) => `[warning] ${e.message}`),
  ];

  if (!ws.length) {
    operatorWarnings.push("No workspaces in scope — connect data or widen filters before rollout planning.");
  }

  const compareNote = input.scenarioCompare?.balancedRecommendation?.rationale
    ? ` Scenario compare: ${input.scenarioCompare.balancedRecommendation.rationale.slice(0, 200)}`
    : "";

  const rolloutSummary = [
    `Strategy: ${preset} — ${strategy.notes ?? ""}`,
    `${recommendedPilotWorkspaces.length} pilot candidate(s); ${recommendedAvoidWorkspaces.length} workspace(s) to defer or harden first.`,
    `System health ${input.overview.systemHealthScore}; ${input.overview.globalSummary.workspaceCount} workspace(s) in view.${compareNote}`,
  ]
    .join(" ")
    .slice(0, 1200);

  return {
    recommendedPilotWorkspaces,
    recommendedAvoidWorkspaces,
    rolloutStages,
    rolloutSummary,
    riskAssessment,
    rollbackTriggers,
    successSignals: [...strategy.requiredSuccessSignals],
    operatorWarnings,
    strategyPreset: preset,
  };
}

export function recommendBentleyRolloutPlan(input: BuildBentleyRolloutCoachingInput): BentleyRolloutCoachingResult {
  return buildBentleyRolloutCoaching(input);
}

export function assessBentleyRolloutRisk(input: BuildBentleyRolloutCoachingInput): BentleyRolloutCoachingResult["riskAssessment"] {
  return buildBentleyRolloutCoaching(input).riskAssessment;
}
