/**
 * Rollout monitoring — evaluates stage health vs strategy thresholds (read-only logic).
 */

import type { PolicyRolloutPlanRow, PolicyRolloutRunRow } from "@/lib/revenue-os/policy-rollout-db";
import type { BentleyRolloutStrategyJson } from "@/lib/revenue-os/rollout-strategies";
import { rolloutStrategyByPreset, type RolloutStrategyPreset } from "@/lib/revenue-os/rollout-strategies";
import {
  collectBentleyRolloutObservation,
  observationDelta,
  type BentleyRolloutObservation,
} from "@/lib/revenue-os/rollout-observation";
import type { BentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import { getLatestActiveRolloutRunForUser } from "@/lib/revenue-os/policy-rollout-db";

export type BentleyRolloutHealth = "healthy" | "warning" | "critical";

export type BentleyRolloutNextAction =
  | "advance_stage"
  | "hold_observe"
  | "pause_rollout"
  | "recommend_rollback";

export type BentleyRolloutMonitoringResult = {
  rolloutHealth: BentleyRolloutHealth;
  breachedTriggers: string[];
  successProgress: Array<{ signal: string; met: boolean; note?: string }>;
  recommendedNextAction: BentleyRolloutNextAction;
  operatorNotes: string[];
  riskLevel: "low" | "medium" | "high";
  activeStageIndex: number;
  stageLabel: string;
  observation: BentleyRolloutObservation;
  baselineObservation: BentleyRolloutObservation | null;
};

function parseStrategy(plan: PolicyRolloutPlanRow): BentleyRolloutStrategyJson {
  const raw = plan.rolloutStrategyJson;
  if (raw && typeof raw === "object" && "scopeProgression" in raw) {
    return raw as unknown as BentleyRolloutStrategyJson;
  }
  return rolloutStrategyByPreset("balanced");
}

function baselineFromRun(run: PolicyRolloutRunRow | null): BentleyRolloutObservation | null {
  const m = run?.monitoringSummaryJson;
  if (!m || typeof m !== "object") return null;
  const b = (m as { baselineObservation?: BentleyRolloutObservation }).baselineObservation;
  return b && typeof b === "object" ? b : null;
}

export function evaluateBentleyRolloutStage(input: {
  plan: PolicyRolloutPlanRow;
  run: PolicyRolloutRunRow | null;
  overview: BentleyOperatorOverview;
}): BentleyRolloutMonitoringResult {
  const strategy = parseStrategy(input.plan);
  const obs = collectBentleyRolloutObservation({ overview: input.overview });
  const base = baselineFromRun(input.run);
  const delta = observationDelta(obs, base);
  const rt = strategy.rollbackThresholds;

  const breachedTriggers: string[] = [];
  if (rt.failedPublishSpike != null && delta.failedPublishDelta >= rt.failedPublishSpike) {
    breachedTriggers.push(`Publish failures increased by ${delta.failedPublishDelta} (threshold ${rt.failedPublishSpike}).`);
  }
  if (rt.failedPublishSpike != null && !base && obs.failedPublishTotal >= (rt.failedPublishSpike ?? 2) * 2) {
    breachedTriggers.push(`Elevated publish failure count (${obs.failedPublishTotal}) without baseline window.`);
  }
  if (rt.approvalBacklogDelta != null && delta.approvalPressureDelta >= rt.approvalBacklogDelta) {
    breachedTriggers.push(`Approval pressure score rose by ${delta.approvalPressureDelta} (threshold ${rt.approvalBacklogDelta}).`);
  }
  if (rt.criticalExceptionCount != null && obs.criticalExceptionCount >= rt.criticalExceptionCount) {
    breachedTriggers.push(`Critical exceptions at ${obs.criticalExceptionCount} (threshold ${rt.criticalExceptionCount}).`);
  }
  if (delta.criticalDelta >= 2) {
    breachedTriggers.push("Critical exception count increased materially vs baseline.");
  }

  const successProgress = strategy.requiredSuccessSignals.map((sig, i) => {
    let met = false;
    let note: string | undefined;
    if (i === 0) {
      met = delta.failedPublishDelta <= 0 && obs.failedPublishTotal <= Math.max(2, rt.failedPublishSpike ?? 2);
      note = met ? "Publish path stable vs baseline." : "Watch publish failures during observation.";
    } else if (i === 1) {
      met = delta.approvalPressureDelta <= 1;
      note = met ? "Approval pressure not spiking." : "Approval queues busier — hold before expanding.";
    } else {
      met = obs.criticalExceptionCount === 0;
      note = met ? "No critical exceptions in window." : "Review exceptions before advancing.";
    }
    return { signal: sig, met, note };
  });

  const metCount = successProgress.filter((s) => s.met).length;
  const totalSignals = Math.max(1, successProgress.length);

  let rolloutHealth: BentleyRolloutHealth = "healthy";
  if (breachedTriggers.length >= 2 || obs.criticalExceptionCount >= (rt.criticalExceptionCount ?? 99)) {
    rolloutHealth = "critical";
  } else if (breachedTriggers.length === 1 || obs.systemHealthScore < 50) {
    rolloutHealth = "warning";
  }

  let recommendedNextAction: BentleyRolloutNextAction = "hold_observe";
  if (breachedTriggers.length >= 2 || (breachedTriggers.length >= 1 && rolloutHealth === "critical")) {
    recommendedNextAction = "recommend_rollback";
  } else if (breachedTriggers.length === 1 && rolloutHealth !== "healthy") {
    recommendedNextAction = "pause_rollout";
  } else if (rolloutHealth === "healthy" && metCount >= Math.ceil(totalSignals * 0.66)) {
    recommendedNextAction = "advance_stage";
  } else {
    recommendedNextAction = "hold_observe";
  }

  const operatorNotes: string[] = [];
  if (!input.run) {
    operatorNotes.push("No rollout run record — create or activate a run to persist stage state.");
  }
  if (obs.workspaceCount === 0) {
    operatorNotes.push("No workspaces in scope — widen filters to observe real rollout surfaces.");
  }
  if (breachedTriggers.length) {
    operatorNotes.push("Review breached triggers before expanding workspace coverage.");
  } else {
    operatorNotes.push("Signals within tolerance for current observation window — continue monitoring.");
  }

  const riskLevel: "low" | "medium" | "high" =
    rolloutHealth === "critical" ? "high" : rolloutHealth === "warning" ? "medium" : "low";

  const idx = input.run?.activeStageIndex ?? 0;
  const stageLabel = strategy.scopeProgression[idx] ?? `stage_${idx + 1}`;

  return {
    rolloutHealth,
    breachedTriggers,
    successProgress,
    recommendedNextAction,
    operatorNotes,
    riskLevel,
    activeStageIndex: idx,
    stageLabel,
    observation: obs,
    baselineObservation: base,
  };
}

export function recommendBentleyRolloutNextAction(result: BentleyRolloutMonitoringResult): BentleyRolloutNextAction {
  return result.recommendedNextAction;
}

export function monitorBentleyRolloutPlan(input: {
  plan: PolicyRolloutPlanRow;
  run: PolicyRolloutRunRow | null;
  overview: BentleyOperatorOverview;
}): BentleyRolloutMonitoringResult {
  return evaluateBentleyRolloutStage(input);
}

/** Latest active/planned/paused rollout run for the user, evaluated against live overview (or null). */
export async function getBentleyRolloutMonitoringSnapshot(input: {
  userId: string;
  overview: BentleyOperatorOverview;
}): Promise<BentleyRolloutMonitoringResult | null> {
  const row = await getLatestActiveRolloutRunForUser({ userId: input.userId });
  if (!row) return null;
  return monitorBentleyRolloutPlan({ plan: row.plan, run: row.run, overview: input.overview });
}

export function buildRolloutMonitoringGuidanceLines(result: BentleyRolloutMonitoringResult | null): {
  bentleyRolloutMonitoringSummaryLine?: string;
  bentleyRolloutStageHealthLine?: string;
  bentleyRolloutNextActionLine?: string;
  bentleyRollbackRecommendedLine?: string;
} {
  if (!result) return {};
  const stage = result.activeStageIndex + 1;
  const bentleyRolloutMonitoringSummaryLine =
    `Rollout monitor: stage ${stage} (${result.stageLabel}) — health ${result.rolloutHealth}, risk ${result.riskLevel}.`.slice(
      0,
      420
    );
  const bentleyRolloutStageHealthLine =
    result.breachedTriggers.length === 0
      ? `Rollout stage ${stage} remains healthy; continue the observation window.`
      : `Rollout stage ${stage} needs attention: ${result.breachedTriggers[0]?.slice(0, 200) ?? "review triggers"}.`;
  const bentleyRolloutNextActionLine = `Bentley recommends: ${result.recommendedNextAction.replace(/_/g, " ")}.`;
  const bentleyRollbackRecommendedLine =
    result.recommendedNextAction === "recommend_rollback"
      ? "Rollback recommended based on breached guardrails — this does not revert live policy automatically."
      : undefined;

  return {
    bentleyRolloutMonitoringSummaryLine,
    bentleyRolloutStageHealthLine: bentleyRolloutStageHealthLine.slice(0, 420),
    bentleyRolloutNextActionLine: bentleyRolloutNextActionLine.slice(0, 320),
    bentleyRollbackRecommendedLine,
  };
}
