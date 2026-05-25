/**
 * Drizzle accessors for `bentley_policy_rollback_*` tables (see drizzle/0072).
 */

import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bentleyPolicyRollbackPackages, bentleyPolicyRollbackRuns } from "@/lib/db/schema";

export type BentleyRollbackType = "blended" | "autonomous" | "cadence" | "notifications";

export type PolicyRollbackPackageRow = typeof bentleyPolicyRollbackPackages.$inferSelect;

export async function getPolicyRollbackPackageByIdForUser(params: {
  userId: string;
  packageId: string;
}): Promise<PolicyRollbackPackageRow | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(bentleyPolicyRollbackPackages)
    .where(
      and(eq(bentleyPolicyRollbackPackages.userId, params.userId), eq(bentleyPolicyRollbackPackages.id, params.packageId))
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listPolicyRollbackPackagesForUser(params: {
  userId: string;
  limit: number;
}): Promise<PolicyRollbackPackageRow[]> {
  const db = await getDb();
  const lim = Math.min(100, Math.max(1, params.limit));
  return db
    .select()
    .from(bentleyPolicyRollbackPackages)
    .where(eq(bentleyPolicyRollbackPackages.userId, params.userId))
    .orderBy(desc(bentleyPolicyRollbackPackages.updatedAt))
    .limit(lim);
}

export async function getLatestSavedRollbackPackageForScenario(params: {
  userId: string;
  scenarioId: string;
}): Promise<PolicyRollbackPackageRow | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(bentleyPolicyRollbackPackages)
    .where(
      and(
        eq(bentleyPolicyRollbackPackages.userId, params.userId),
        eq(bentleyPolicyRollbackPackages.sourceScenarioId, params.scenarioId),
        eq(bentleyPolicyRollbackPackages.isSaved, true)
      )
    )
    .orderBy(desc(bentleyPolicyRollbackPackages.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLatestSavedRollbackPackageForUser(params: {
  userId: string;
}): Promise<PolicyRollbackPackageRow | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(bentleyPolicyRollbackPackages)
    .where(and(eq(bentleyPolicyRollbackPackages.userId, params.userId), eq(bentleyPolicyRollbackPackages.isSaved, true)))
    .orderBy(desc(bentleyPolicyRollbackPackages.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

export type PolicyRollbackRunRow = typeof bentleyPolicyRollbackRuns.$inferSelect;

export async function insertPolicyRollbackRun(params: {
  rollbackPackageId: string;
  runStatus: string;
  reviewedByUserId?: string | null;
  runSummaryJson?: Record<string, unknown> | null;
}): Promise<PolicyRollbackRunRow | null> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.insert(bentleyPolicyRollbackRuns).values({
    id,
    rollbackPackageId: params.rollbackPackageId,
    runStatus: params.runStatus.slice(0, 24),
    reviewedByUserId: params.reviewedByUserId?.trim() || null,
    runSummaryJson: params.runSummaryJson ?? null,
    appliedAt: null,
  });
  const [row] = await db.select().from(bentleyPolicyRollbackRuns).where(eq(bentleyPolicyRollbackRuns.id, id)).limit(1);
  return row ?? null;
}

export async function updatePolicyRollbackRun(params: {
  runId: string;
  runStatus: string;
  appliedAt?: Date | null;
  runSummaryJson?: Record<string, unknown> | null;
}): Promise<boolean> {
  const db = await getDb();
  await db
    .update(bentleyPolicyRollbackRuns)
    .set({
      runStatus: params.runStatus.slice(0, 24),
      appliedAt: params.appliedAt ?? undefined,
      runSummaryJson: params.runSummaryJson ?? undefined,
    })
    .where(eq(bentleyPolicyRollbackRuns.id, params.runId));
  return true;
}
