/**
 * Rollout run state transitions — operational metadata only (no live policy apply/revert).
 */

import {
  getPolicyRolloutRunByIdForUser,
  getPolicyRolloutPlanByIdForUser,
  getLatestRolloutRunForPlan,
  insertPolicyRolloutRun,
  updatePolicyRolloutRun,
} from "@/lib/revenue-os/policy-rollout-db";
import type { BentleyRolloutStrategyJson } from "@/lib/revenue-os/rollout-strategies";
import { rolloutStrategyByPreset } from "@/lib/revenue-os/rollout-strategies";

function parseMaxStages(planRolloutJson: unknown): number {
  const s = planRolloutJson as BentleyRolloutStrategyJson | null;
  return s?.scopeProgression?.length ?? 3;
}

export async function advanceBentleyRolloutStage(input: {
  userId: string;
  planId: string;
  runId?: string | null;
}): Promise<{ ok: boolean; error?: string; runId?: string }> {
  const uid = String(input.userId).trim();
  const plan = await getPolicyRolloutPlanByIdForUser({ userId: uid, planId: input.planId });
  if (!plan) return { ok: false, error: "Plan not found" };

  let run = input.runId
    ? (await getPolicyRolloutRunByIdForUser({ userId: uid, runId: input.runId }))?.run
    : await getLatestRolloutRunForPlan({ rolloutPlanId: plan.id });

  if (!run) {
    const inserted = await insertPolicyRolloutRun({
      rolloutPlanId: plan.id,
      runStatus: "active",
      startedAt: new Date(),
      activeStageIndex: 0,
      stageStatus: "observing",
      recommendedAction: "hold_observe",
    });
    if (!inserted) return { ok: false, error: "Could not create run" };
    run = inserted;
  }

  const max = parseMaxStages(plan.rolloutStrategyJson);
  const cur = run.activeStageIndex ?? 0;
  const next = Math.min(cur + 1, Math.max(0, max - 1));

  const ok = await updatePolicyRolloutRun({
    runId: run.id,
    runStatus: "active",
    activeStageIndex: next,
    stageStatus: "observing",
    recommendedAction: "hold_observe",
    monitoringSummaryJson: {
      ...(typeof run.monitoringSummaryJson === "object" && run.monitoringSummaryJson !== null
        ? (run.monitoringSummaryJson as Record<string, unknown>)
        : {}),
      lastAdvancedAt: new Date().toISOString(),
    },
  });

  return ok ? { ok: true, runId: run.id } : { ok: false, error: "Update failed" };
}

export async function pauseBentleyRollout(input: {
  userId: string;
  runId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const row = await getPolicyRolloutRunByIdForUser({ userId: input.userId, runId: input.runId });
  if (!row) return { ok: false, error: "Run not found" };
  const ok = await updatePolicyRolloutRun({
    runId: row.run.id,
    runStatus: "paused",
    stageStatus: "paused",
    recommendedAction: "pause_rollout",
  });
  return ok ? { ok: true } : { ok: false, error: "Update failed" };
}

export async function markBentleyRolloutRollbackRecommended(input: {
  userId: string;
  runId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const row = await getPolicyRolloutRunByIdForUser({ userId: input.userId, runId: input.runId });
  if (!row) return { ok: false, error: "Run not found" };
  const ok = await updatePolicyRolloutRun({
    runId: row.run.id,
    stageStatus: "breached",
    recommendedAction: "recommend_rollback",
    rollbackTriggeredAt: new Date(),
  });
  return ok ? { ok: true } : { ok: false, error: "Update failed" };
}

export async function completeBentleyRollout(input: {
  userId: string;
  runId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const row = await getPolicyRolloutRunByIdForUser({ userId: input.userId, runId: input.runId });
  if (!row) return { ok: false, error: "Run not found" };
  const ok = await updatePolicyRolloutRun({
    runId: row.run.id,
    runStatus: "completed",
    completedAt: new Date(),
    stageStatus: "completed",
    recommendedAction: "completed",
  });
  return ok ? { ok: true } : { ok: false, error: "Update failed" };
}
