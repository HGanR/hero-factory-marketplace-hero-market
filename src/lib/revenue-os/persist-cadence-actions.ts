/**
 * Persists cadence run records and queue metadata updates (idempotent-friendly).
 */

import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bentleyCadenceRuns, bentleyDistributionQueue } from "@/lib/db/schema";
import type { BentleyCadencePlan } from "@/lib/revenue-os/cadence-engine";
import {
  promoteDistributionQueueItem,
  suppressDistributionQueueItem,
  markDistributionQueueForRetest,
  markDistributionQueueStale,
  archiveDistributionQueueItem,
  markDistributionQueueCadenceRetry,
  markDistributionQueueCadenceBlocked,
} from "@/lib/revenue-os/distribution-queue-actions";

export type CadenceRunType =
  | "daily_refresh"
  | "winner_promotion"
  | "retry_failed"
  | "stale_cleanup"
  | "retest_planning";

export async function persistCadenceRun(params: {
  userId: string;
  clientId: string;
  trustId: string;
  runType: CadenceRunType;
  plan: BentleyCadencePlan;
  runStatus: "started" | "completed" | "partial" | "failed";
}): Promise<{ id: string; ok: boolean }> {
  const id = crypto.randomUUID();
  try {
    const db = await getDb();
    await db.insert(bentleyCadenceRuns).values({
      id,
      userId: params.userId,
      clientId: params.clientId,
      trustId: params.trustId,
      runType: params.runType,
      runStatus: params.runStatus,
      runSummaryJson: {
        cadenceSummary: params.plan.cadenceSummary,
        counts: {
          promote: params.plan.promoteNow.length,
          publishNext: params.plan.publishNext.length,
          retry: params.plan.retryNow.length,
          retest: params.plan.retestNext.length,
          suppress: params.plan.suppressNow.length,
          archive: params.plan.archiveNow.length,
          blocked: params.plan.blockedOperationally.length,
        },
        nextSchedulerAction: params.plan.nextSchedulerAction,
      },
      startedAt: new Date(),
      completedAt: new Date(),
    });
    return { id, ok: true };
  } catch (e) {
    console.warn("[persist-cadence-actions] persistCadenceRun failed", e);
    return { id, ok: false };
  }
}

export type PersistCadenceQueueUpdatesParams = {
  userId: string;
  clientId: string;
  trustId: string;
  plan: BentleyCadencePlan;
  /** When false, skip per-row queue mutations. */
  applyQueueMutations?: boolean;
};

export async function persistCadenceQueueUpdates(
  params: PersistCadenceQueueUpdatesParams
): Promise<{ applied: number; skipped: number }> {
  if (params.applyQueueMutations === false) {
    return { applied: 0, skipped: 0 };
  }
  let applied = 0;
  let skipped = 0;
  const scope = {
    userId: params.userId,
    clientId: params.clientId,
    trustId: params.trustId,
  };
  const p = params.plan;

  for (const x of p.promoteNow) {
    const r = await promoteDistributionQueueItem({ ...scope, queueId: x.queueId, reason: x.reason });
    if (r.ok) applied++;
    else skipped++;
  }
  for (const x of p.suppressNow) {
    const r = await suppressDistributionQueueItem({ ...scope, queueId: x.queueId, reason: x.reason });
    if (r.ok) applied++;
    else skipped++;
  }
  for (const x of p.archiveNow) {
    const r = await archiveDistributionQueueItem({ ...scope, queueId: x.queueId });
    if (r.ok) applied++;
    else skipped++;
  }
  for (const x of p.retryNow) {
    const r = await markDistributionQueueCadenceRetry({ ...scope, queueId: x.queueId, note: x.reason });
    if (r.ok) applied++;
    else skipped++;
  }
  for (const x of p.blockedOperationally) {
    const r = await markDistributionQueueCadenceBlocked({ ...scope, queueId: x.queueId, note: x.reason });
    if (r.ok) applied++;
    else skipped++;
  }
  for (const x of p.retestNext) {
    if (!x.queueId || x.kind === "planned_retest") continue;
    const r = await markDistributionQueueForRetest({ ...scope, queueId: x.queueId, note: x.reason });
    if (r.ok) applied++;
    else skipped++;
  }

  return { applied, skipped };
}

export async function fetchLatestCadenceRun(params: {
  userId: string;
  clientId: string;
  trustId: string;
}): Promise<typeof bentleyCadenceRuns.$inferSelect | null> {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(bentleyCadenceRuns)
      .where(
        and(
          eq(bentleyCadenceRuns.userId, params.userId),
          eq(bentleyCadenceRuns.clientId, params.clientId ?? ""),
          eq(bentleyCadenceRuns.trustId, params.trustId ?? "")
        )
      )
      .orderBy(desc(bentleyCadenceRuns.startedAt))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
