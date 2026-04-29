/**
 * UI payloads for rollout monitoring surfaces.
 */

import type { BentleyRolloutMonitoringResult } from "@/lib/revenue-os/rollout-monitoring";

export function buildRolloutHealthCard(result: BentleyRolloutMonitoringResult) {
  return {
    id: "rollout_health",
    label: "Rollout health",
    value: result.rolloutHealth,
    detail: `Risk: ${result.riskLevel} · Stage ${result.activeStageIndex + 1}: ${result.stageLabel}`,
  };
}

export function buildCurrentStageStatusCard(result: BentleyRolloutMonitoringResult) {
  return {
    stageIndex: result.activeStageIndex,
    stageLabel: result.stageLabel,
    status: result.rolloutHealth,
    notes: result.operatorNotes.slice(0, 4),
  };
}

export function buildBreachedTriggerList(result: BentleyRolloutMonitoringResult) {
  return result.breachedTriggers.map((t, i) => ({ id: `bt_${i}`, text: t }));
}

export function buildSuccessSignalProgressTable(result: BentleyRolloutMonitoringResult) {
  return result.successProgress.map((s, i) => ({
    id: `sig_${i}`,
    signal: s.signal,
    met: s.met,
    note: s.note ?? "",
  }));
}

export function buildRecommendedNextActionPanel(result: BentleyRolloutMonitoringResult) {
  return {
    action: result.recommendedNextAction,
    label: result.recommendedNextAction.replace(/_/g, " "),
    riskLevel: result.riskLevel,
  };
}

export function buildStageAdvancementControlStrip(input: {
  planId: string;
  runId: string | null;
  canAdvance: boolean;
}) {
  return {
    planId: input.planId,
    runId: input.runId,
    advanceEnabled: input.canAdvance,
    pauseEnabled: Boolean(input.runId),
    completeEnabled: Boolean(input.runId),
  };
}

export function buildRollbackRecommendationWarningPanel(result: BentleyRolloutMonitoringResult) {
  const show = result.recommendedNextAction === "recommend_rollback" || result.breachedTriggers.length >= 2;
  return {
    visible: show,
    title: "Rollback recommendation",
    body:
      "Guardrails indicate elevated risk. Review live policy state manually — Bentley does not revert policies automatically.",
    triggers: result.breachedTriggers,
  };
}

export function buildRolloutMonitoringUiPayload(
  result: BentleyRolloutMonitoringResult,
  opts?: { planId: string; runId: string | null }
) {
  return {
    health: buildRolloutHealthCard(result),
    stage: buildCurrentStageStatusCard(result),
    breached: buildBreachedTriggerList(result),
    success: buildSuccessSignalProgressTable(result),
    nextAction: buildRecommendedNextActionPanel(result),
    rollbackPanel: buildRollbackRecommendationWarningPanel(result),
    ...(opts
      ? {
          controls: buildStageAdvancementControlStrip({
            planId: opts.planId,
            runId: opts.runId,
            canAdvance: result.recommendedNextAction === "advance_stage",
          }),
        }
      : {}),
  };
}
