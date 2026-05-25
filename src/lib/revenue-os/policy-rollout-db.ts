/**
 * Drizzle accessors for `bentley_policy_rollout_*` tables (see drizzle/0070–0071).
 */

import crypto from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  bentleyPolicyRolloutPlans,
  bentleyPolicyRolloutRuns,
  bentleyPolicyRolloutStageChecks,
} from "@/lib/db/schema";

export type BentleyRolloutType = "blended" | "autonomous" | "cadence" | "notifications";

export type PolicyRolloutPlanRow = typeof bentleyPolicyRolloutPlans.$inferSelect;
export type PolicyRolloutRunRow = typeof bentleyPolicyRolloutRuns.$inferSelect;

export async function getPolicyRolloutPlanByIdForUser(params: {
  userId: string;
  planId: string;
}): Promise<PolicyRolloutPlanRow | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(bentleyPolicyRolloutPlans)
    .where(and(eq(bentleyPolicyRolloutPlans.userId, params.userId), eq(bentleyPolicyRolloutPlans.id, params.planId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listPolicyRolloutPlansForUser(params: {
  userId: string;
  limit: number;
}): Promise<PolicyRolloutPlanRow[]> {
  const db = await getDb();
  const lim = Math.min(100, Math.max(1, params.limit));
  return db
    .select()
    .from(bentleyPolicyRolloutPlans)
    .where(eq(bentleyPolicyRolloutPlans.userId, params.userId))
    .orderBy(desc(bentleyPolicyRolloutPlans.updatedAt))
    .limit(lim);
}

export async function insertPolicyRolloutPlan(params: {
  userId: string;
  rolloutType: BentleyRolloutType;
  sourceScenarioId: string | null;
  name: string;
  scopeJson: Record<string, unknown> | null;
  rolloutStrategyJson: Record<string, unknown>;
  guardrailsJson: Record<string, unknown> | null;
  rollbackPlanJson: Record<string, unknown> | null;
  isSaved: boolean;
}): Promise<PolicyRolloutPlanRow | null> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.insert(bentleyPolicyRolloutPlans).values({
    id,
    userId: params.userId,
    rolloutType: params.rolloutType,
    sourceScenarioId: params.sourceScenarioId,
    name: params.name.slice(0, 255),
    scopeJson: params.scopeJson,
    rolloutStrategyJson: params.rolloutStrategyJson,
    guardrailsJson: params.guardrailsJson,
    rollbackPlanJson: params.rollbackPlanJson,
    isSaved: params.isSaved,
  });
  return getPolicyRolloutPlanByIdForUser({ userId: params.userId, planId: id });
}

export async function getLatestRolloutRunForPlan(params: { rolloutPlanId: string }): Promise<PolicyRolloutRunRow | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(bentleyPolicyRolloutRuns)
    .where(eq(bentleyPolicyRolloutRuns.rolloutPlanId, params.rolloutPlanId))
    .orderBy(desc(bentleyPolicyRolloutRuns.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPolicyRolloutRunByIdForUser(params: {
  userId: string;
  runId: string;
}): Promise<{ run: PolicyRolloutRunRow } | null> {
  const db = await getDb();
  const rows = await db
    .select({ run: bentleyPolicyRolloutRuns })
    .from(bentleyPolicyRolloutRuns)
    .innerJoin(bentleyPolicyRolloutPlans, eq(bentleyPolicyRolloutRuns.rolloutPlanId, bentleyPolicyRolloutPlans.id))
    .where(and(eq(bentleyPolicyRolloutPlans.userId, params.userId), eq(bentleyPolicyRolloutRuns.id, params.runId)))
    .limit(1);
  const r = rows[0]?.run;
  return r ? { run: r } : null;
}

export async function getLatestActiveRolloutRunForUser(params: {
  userId: string;
}): Promise<{ plan: PolicyRolloutPlanRow; run: PolicyRolloutRunRow } | null> {
  const db = await getDb();
  const rows = await db
    .select({ plan: bentleyPolicyRolloutPlans, run: bentleyPolicyRolloutRuns })
    .from(bentleyPolicyRolloutRuns)
    .innerJoin(bentleyPolicyRolloutPlans, eq(bentleyPolicyRolloutRuns.rolloutPlanId, bentleyPolicyRolloutPlans.id))
    .where(
      and(
        eq(bentleyPolicyRolloutPlans.userId, params.userId),
        inArray(bentleyPolicyRolloutRuns.runStatus, ["planned", "active", "paused"])
      )
    )
    .orderBy(desc(bentleyPolicyRolloutRuns.createdAt))
    .limit(1);
  const row = rows[0];
  return row?.plan && row?.run ? { plan: row.plan, run: row.run } : null;
}

export async function insertPolicyRolloutRun(params: {
  rolloutPlanId: string;
  runStatus: string;
  startedAt?: Date | null;
  activeStageIndex?: number | null;
  stageStatus?: string | null;
  recommendedAction?: string | null;
  monitoringSummaryJson?: Record<string, unknown> | null;
}): Promise<PolicyRolloutRunRow | null> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.insert(bentleyPolicyRolloutRuns).values({
    id,
    rolloutPlanId: params.rolloutPlanId,
    runStatus: params.runStatus.slice(0, 24),
    runSummaryJson: null,
    startedAt: params.startedAt ?? null,
    completedAt: null,
    activeStageIndex: params.activeStageIndex ?? null,
    stageStatus: params.stageStatus?.slice(0, 32) ?? null,
    stageProgressJson: null,
    monitoringSummaryJson: params.monitoringSummaryJson ?? null,
    recommendedAction: params.recommendedAction?.slice(0, 64) ?? null,
    rollbackTriggeredAt: null,
  });
  const [row] = await db.select().from(bentleyPolicyRolloutRuns).where(eq(bentleyPolicyRolloutRuns.id, id)).limit(1);
  return row ?? null;
}

export async function updatePolicyRolloutRun(params: {
  runId: string;
  runStatus?: string;
  startedAt?: Date | null;
  completedAt?: Date | null;
  activeStageIndex?: number | null;
  stageStatus?: string | null;
  stageProgressJson?: Record<string, unknown> | null;
  monitoringSummaryJson?: Record<string, unknown> | null;
  recommendedAction?: string | null;
  rollbackTriggeredAt?: Date | null;
}): Promise<boolean> {
  const db = await getDb();
  const set: Partial<typeof bentleyPolicyRolloutRuns.$inferInsert> = {};
  if (params.runStatus !== undefined) set.runStatus = params.runStatus.slice(0, 24);
  if (params.startedAt !== undefined) set.startedAt = params.startedAt;
  if (params.completedAt !== undefined) set.completedAt = params.completedAt;
  if (params.activeStageIndex !== undefined) set.activeStageIndex = params.activeStageIndex;
  if (params.stageStatus !== undefined) set.stageStatus = params.stageStatus?.slice(0, 32) ?? null;
  if (params.stageProgressJson !== undefined) set.stageProgressJson = params.stageProgressJson;
  if (params.monitoringSummaryJson !== undefined) set.monitoringSummaryJson = params.monitoringSummaryJson;
  if (params.recommendedAction !== undefined) set.recommendedAction = params.recommendedAction?.slice(0, 64) ?? null;
  if (params.rollbackTriggeredAt !== undefined) set.rollbackTriggeredAt = params.rollbackTriggeredAt;
  if (Object.keys(set).length === 0) return true;
  await db.update(bentleyPolicyRolloutRuns).set(set).where(eq(bentleyPolicyRolloutRuns.id, params.runId));
  return true;
}

export async function insertPolicyRolloutStageCheck(params: {
  rolloutRunId: string;
  stageIndex: number;
  checkStatus: string;
  observedMetricsJson: Record<string, unknown> | null;
  triggerBreachesJson: unknown[] | Record<string, unknown> | null;
  successProgressJson: Record<string, unknown> | unknown[] | null;
}): Promise<void> {
  const db = await getDb();
  await db.insert(bentleyPolicyRolloutStageChecks).values({
    id: crypto.randomUUID(),
    rolloutRunId: params.rolloutRunId,
    stageIndex: params.stageIndex,
    checkStatus: params.checkStatus.slice(0, 24),
    observedMetricsJson: params.observedMetricsJson,
    triggerBreachesJson: params.triggerBreachesJson,
    successProgressJson: params.successProgressJson,
  });
}
