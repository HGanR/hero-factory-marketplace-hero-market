/**
 * Safe transitions + reads for bentley_distribution_queue.
 * No throw on benign no-ops; logs and returns { ok, reason }.
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bentleyDistributionQueue, bentleyDistributionQueueTargets } from "@/lib/db/schema";

export type DistributionQueueTargetRow = {
  id: string;
  queueId: string;
  targetPlatform: string;
  targetProfileId: string | null;
  targetFormat: string;
  payloadJson: unknown;
  targetStatus: string;
  routingStatus: string | null;
  routingWarningsJson: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type DistributionQueueRow = {
  id: string;
  userId: string;
  clientId: string;
  trustId: string;
  experimentId: string | null;
  experimentVariantId: string | null;
  title: string;
  platform: string;
  contentType: string;
  queueStatus: string;
  approvalStatus: string;
  scheduledFor: Date | null;
  publishedAt: Date | null;
  publishPriority: number | null;
  publishAttemptCount: number;
  lastPublishError: string | null;
  externalPostRef: string | null;
  lastSyncedAt: Date | null;
  performanceSyncStatus: string | null;
  leadHandoffStatus: string | null;
  workflowNote: string | null;
  winningSignalSource: string | null;
  cadencePriority: number | null;
  staleAfterAt: Date | null;
  lastOptimizationAction: string | null;
  suppressionReason: string | null;
  promotionReason: string | null;
  retestEligibleAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function scopeWhere(userId: string, clientId: string, trustId: string) {
  return and(
    eq(bentleyDistributionQueue.userId, userId),
    eq(bentleyDistributionQueue.clientId, clientId ?? ""),
    eq(bentleyDistributionQueue.trustId, trustId ?? "")
  );
}

function mapRow(r: typeof bentleyDistributionQueue.$inferSelect): DistributionQueueRow {
  return {
    id: r.id,
    userId: r.userId,
    clientId: r.clientId,
    trustId: r.trustId,
    experimentId: r.experimentId ?? null,
    experimentVariantId: r.experimentVariantId ?? null,
    title: r.title,
    platform: r.platform,
    contentType: r.contentType,
    queueStatus: r.queueStatus,
    approvalStatus: r.approvalStatus,
    scheduledFor: r.scheduledFor ?? null,
    publishedAt: r.publishedAt ?? null,
    publishPriority: r.publishPriority ?? null,
    publishAttemptCount: r.publishAttemptCount ?? 0,
    lastPublishError: r.lastPublishError ?? null,
    externalPostRef: r.externalPostRef ?? null,
    lastSyncedAt: r.lastSyncedAt ?? null,
    performanceSyncStatus: r.performanceSyncStatus ?? null,
    leadHandoffStatus: r.leadHandoffStatus ?? null,
    workflowNote: r.workflowNote ?? null,
    winningSignalSource: r.winningSignalSource ?? null,
    cadencePriority: r.cadencePriority ?? null,
    staleAfterAt: r.staleAfterAt ?? null,
    lastOptimizationAction: r.lastOptimizationAction ?? null,
    suppressionReason: r.suppressionReason ?? null,
    promotionReason: r.promotionReason ?? null,
    retestEligibleAt: r.retestEligibleAt ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function fetchDistributionQueueState(params: {
  userId: string;
  clientId: string;
  trustId: string;
  limit?: number;
}): Promise<DistributionQueueRow[]> {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(bentleyDistributionQueue)
      .where(scopeWhere(params.userId, params.clientId, params.trustId))
      .orderBy(desc(bentleyDistributionQueue.updatedAt))
      .limit(Math.min(200, Math.max(1, params.limit ?? 80)));
    return rows.map(mapRow);
  } catch (e) {
    console.warn("[distribution-queue-actions] fetch failed", e);
    return [];
  }
}

export async function getDistributionQueueItemByExternalRef(params: {
  userId: string;
  clientId: string;
  trustId: string;
  externalPostRef: string;
}): Promise<DistributionQueueRow | null> {
  const ref = params.externalPostRef.trim().slice(0, 512);
  if (!ref) return null;
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(bentleyDistributionQueue)
      .where(
        and(
          eq(bentleyDistributionQueue.externalPostRef, ref),
          scopeWhere(params.userId, params.clientId, params.trustId)
        )
      )
      .limit(1);
    return rows[0] ? mapRow(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function getDistributionQueueItemForUser(params: {
  userId: string;
  clientId: string;
  trustId: string;
  queueId: string;
}): Promise<DistributionQueueRow | null> {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(bentleyDistributionQueue)
      .where(
        and(
          eq(bentleyDistributionQueue.id, params.queueId),
          scopeWhere(params.userId, params.clientId, params.trustId)
        )
      )
      .limit(1);
    return rows[0] ? mapRow(rows[0]) : null;
  } catch {
    return null;
  }
}

function mapTargetRow(r: typeof bentleyDistributionQueueTargets.$inferSelect): DistributionQueueTargetRow {
  return {
    id: r.id,
    queueId: r.queueId,
    targetPlatform: r.targetPlatform,
    targetProfileId: r.targetProfileId ?? null,
    targetFormat: r.targetFormat,
    payloadJson: r.payloadJson,
    targetStatus: r.targetStatus,
    routingStatus: r.routingStatus ?? null,
    routingWarningsJson: r.routingWarningsJson,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function fetchDistributionQueueTargetsForQueues(params: {
  queueIds: string[];
}): Promise<DistributionQueueTargetRow[]> {
  const ids = params.queueIds.filter(Boolean);
  if (!ids.length) return [];
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(bentleyDistributionQueueTargets)
      .where(inArray(bentleyDistributionQueueTargets.queueId, ids));
    return rows.map(mapTargetRow);
  } catch (e) {
    console.warn("[distribution-queue-actions] fetch targets failed", e);
    return [];
  }
}

export async function getDistributionQueueTargetForUser(params: {
  userId: string;
  clientId: string;
  trustId: string;
  queueTargetId: string;
}): Promise<DistributionQueueTargetRow | null> {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(bentleyDistributionQueueTargets)
      .where(eq(bentleyDistributionQueueTargets.id, params.queueTargetId))
      .limit(1);
    const t = rows[0];
    if (!t) return null;
    const q = await getDistributionQueueItemForUser({
      userId: params.userId,
      clientId: params.clientId,
      trustId: params.trustId,
      queueId: t.queueId,
    });
    if (!q) return null;
    return mapTargetRow(t);
  } catch {
    return null;
  }
}

export async function fetchDistributionQueueTargetsForQueue(params: {
  userId: string;
  clientId: string;
  trustId: string;
  queueId: string;
}): Promise<DistributionQueueTargetRow[]> {
  const q = await getDistributionQueueItemForUser(params);
  if (!q) return [];
  return fetchDistributionQueueTargetsForQueues({ queueIds: [params.queueId] });
}

export type ActionResult = { ok: boolean; reason?: string; row?: DistributionQueueRow };

export async function approveDistributionQueueItem(params: {
  userId: string;
  clientId: string;
  trustId: string;
  queueId: string;
}): Promise<ActionResult> {
  const cur = await getDistributionQueueItemForUser(params);
  if (!cur) return { ok: false, reason: "not_found" };
  if (cur.queueStatus === "published" || cur.queueStatus === "archived") {
    return { ok: true, reason: "no_op_terminal", row: cur };
  }
  if (cur.approvalStatus === "rejected") return { ok: false, reason: "already_rejected" };
  if (cur.approvalStatus === "approved" && cur.queueStatus === "approved") {
    return { ok: true, reason: "no_op_already_approved", row: cur };
  }
  try {
    const db = await getDb();
    await db
      .update(bentleyDistributionQueue)
      .set({
        approvalStatus: "approved",
        queueStatus: "approved",
        workflowNote: null,
      })
      .where(eq(bentleyDistributionQueue.id, params.queueId));
    const next = await getDistributionQueueItemForUser(params);
    return { ok: true, row: next ?? cur };
  } catch (e) {
    console.error("[distribution-queue-actions] approve failed", e);
    return { ok: false, reason: "db_error" };
  }
}

export async function rejectDistributionQueueItem(params: {
  userId: string;
  clientId: string;
  trustId: string;
  queueId: string;
  note?: string | null;
}): Promise<ActionResult> {
  const cur = await getDistributionQueueItemForUser(params);
  if (!cur) return { ok: false, reason: "not_found" };
  if (cur.queueStatus === "published" || cur.queueStatus === "archived") {
    return { ok: false, reason: "invalid_state" };
  }
  try {
    const db = await getDb();
    await db
      .update(bentleyDistributionQueue)
      .set({
        approvalStatus: "rejected",
        queueStatus: "archived",
        workflowNote: params.note?.slice(0, 8000) ?? cur.workflowNote,
      })
      .where(eq(bentleyDistributionQueue.id, params.queueId));
    const next = await getDistributionQueueItemForUser(params);
    return { ok: true, row: next ?? cur };
  } catch (e) {
    console.error("[distribution-queue-actions] reject failed", e);
    return { ok: false, reason: "db_error" };
  }
}

export async function scheduleDistributionQueueItem(params: {
  userId: string;
  clientId: string;
  trustId: string;
  queueId: string;
  scheduledFor: Date;
}): Promise<ActionResult> {
  const cur = await getDistributionQueueItemForUser(params);
  if (!cur) return { ok: false, reason: "not_found" };
  if (cur.approvalStatus === "rejected") return { ok: false, reason: "rejected" };
  if (cur.approvalStatus === "pending") return { ok: false, reason: "approval_pending" };
  if (cur.queueStatus === "published" || cur.queueStatus === "archived") {
    return { ok: false, reason: "invalid_state" };
  }
  try {
    const db = await getDb();
    await db
      .update(bentleyDistributionQueue)
      .set({
        queueStatus: "scheduled",
        scheduledFor: params.scheduledFor,
      })
      .where(eq(bentleyDistributionQueue.id, params.queueId));
    const next = await getDistributionQueueItemForUser(params);
    return { ok: true, row: next ?? cur };
  } catch (e) {
    console.error("[distribution-queue-actions] schedule failed", e);
    return { ok: false, reason: "db_error" };
  }
}

export async function markDistributionQueuePublished(params: {
  userId: string;
  clientId: string;
  trustId: string;
  queueId: string;
  externalPostRef?: string | null;
  /** When true, skip strict scheduled-only check (manual / mock publish). */
  mockOrManual?: boolean;
}): Promise<ActionResult> {
  const cur = await getDistributionQueueItemForUser(params);
  if (!cur) return { ok: false, reason: "not_found" };
  if (cur.queueStatus === "published") return { ok: true, reason: "no_op_already_published", row: cur };
  if (cur.queueStatus === "archived") return { ok: false, reason: "archived" };
  if (cur.approvalStatus === "pending") return { ok: false, reason: "approval_pending" };
  if (cur.approvalStatus === "rejected") return { ok: false, reason: "rejected" };
  const allowed =
    cur.queueStatus === "scheduled" ||
    cur.queueStatus === "approved" ||
    (params.mockOrManual && (cur.queueStatus === "draft" || cur.queueStatus === "failed"));
  if (!allowed) return { ok: false, reason: "invalid_transition" };
  try {
    const db = await getDb();
    await db
      .update(bentleyDistributionQueue)
      .set({
        queueStatus: "published",
        publishedAt: new Date(),
        externalPostRef: params.externalPostRef?.slice(0, 512) ?? cur.externalPostRef,
        lastPublishError: null,
        performanceSyncStatus: "pending",
      })
      .where(eq(bentleyDistributionQueue.id, params.queueId));
    const next = await getDistributionQueueItemForUser(params);
    return { ok: true, row: next ?? cur };
  } catch (e) {
    console.error("[distribution-queue-actions] publish failed", e);
    return { ok: false, reason: "db_error" };
  }
}

export async function markDistributionQueueFailed(params: {
  userId: string;
  clientId: string;
  trustId: string;
  queueId: string;
  error: string;
}): Promise<ActionResult> {
  const cur = await getDistributionQueueItemForUser(params);
  if (!cur) return { ok: false, reason: "not_found" };
  if (cur.queueStatus === "published") return { ok: false, reason: "already_published" };
  try {
    const db = await getDb();
    const attempts = (cur.publishAttemptCount ?? 0) + 1;
    await db
      .update(bentleyDistributionQueue)
      .set({
        queueStatus: "failed",
        publishAttemptCount: attempts,
        lastPublishError: params.error.slice(0, 8000),
      })
      .where(eq(bentleyDistributionQueue.id, params.queueId));
    const next = await getDistributionQueueItemForUser(params);
    return { ok: true, row: next ?? cur };
  } catch (e) {
    console.error("[distribution-queue-actions] mark failed", e);
    return { ok: false, reason: "db_error" };
  }
}

export async function archiveDistributionQueueItem(params: {
  userId: string;
  clientId: string;
  trustId: string;
  queueId: string;
}): Promise<ActionResult> {
  const cur = await getDistributionQueueItemForUser(params);
  if (!cur) return { ok: false, reason: "not_found" };
  if (cur.queueStatus === "archived") return { ok: true, reason: "no_op", row: cur };
  try {
    const db = await getDb();
    await db
      .update(bentleyDistributionQueue)
      .set({ queueStatus: "archived" })
      .where(eq(bentleyDistributionQueue.id, params.queueId));
    const next = await getDistributionQueueItemForUser(params);
    return { ok: true, row: next ?? cur };
  } catch (e) {
    console.error("[distribution-queue-actions] archive failed", e);
    return { ok: false, reason: "db_error" };
  }
}

export async function promoteDistributionQueueItem(params: {
  userId: string;
  clientId: string;
  trustId: string;
  queueId: string;
  reason?: string | null;
}): Promise<ActionResult> {
  const cur = await getDistributionQueueItemForUser(params);
  if (!cur) return { ok: false, reason: "not_found" };
  if (cur.queueStatus === "published" || cur.queueStatus === "archived") {
    return { ok: true, reason: "no_op_terminal", row: cur };
  }
  if (cur.promotionReason?.trim() && cur.promotionReason === params.reason?.trim()) {
    return { ok: true, reason: "no_op_same_promotion", row: cur };
  }
  try {
    const db = await getDb();
    const pri = Math.min(10, Math.max((cur.publishPriority ?? 5) + 2, (cur.cadencePriority ?? 5) + 2));
    await db
      .update(bentleyDistributionQueue)
      .set({
        publishPriority: pri,
        cadencePriority: pri,
        promotionReason: params.reason?.slice(0, 512) ?? cur.promotionReason,
        lastOptimizationAction: "cadence_promote",
        suppressionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(bentleyDistributionQueue.id, params.queueId));
    const next = await getDistributionQueueItemForUser(params);
    return { ok: true, row: next ?? cur };
  } catch (e) {
    console.error("[distribution-queue-actions] promote failed", e);
    return { ok: false, reason: "db_error" };
  }
}

export async function suppressDistributionQueueItem(params: {
  userId: string;
  clientId: string;
  trustId: string;
  queueId: string;
  reason?: string | null;
}): Promise<ActionResult> {
  const cur = await getDistributionQueueItemForUser(params);
  if (!cur) return { ok: false, reason: "not_found" };
  if (cur.queueStatus === "published" || cur.queueStatus === "archived") {
    return { ok: true, reason: "no_op_terminal", row: cur };
  }
  try {
    const db = await getDb();
    await db
      .update(bentleyDistributionQueue)
      .set({
        cadencePriority: 1,
        suppressionReason: params.reason?.slice(0, 512) ?? "cadence_suppress",
        promotionReason: null,
        lastOptimizationAction: "cadence_suppress",
        workflowNote: params.reason?.slice(0, 8000) ?? cur.workflowNote,
        updatedAt: new Date(),
      })
      .where(eq(bentleyDistributionQueue.id, params.queueId));
    const next = await getDistributionQueueItemForUser(params);
    return { ok: true, row: next ?? cur };
  } catch (e) {
    console.error("[distribution-queue-actions] suppress failed", e);
    return { ok: false, reason: "db_error" };
  }
}

export async function markDistributionQueueForRetest(params: {
  userId: string;
  clientId: string;
  trustId: string;
  queueId: string;
  note?: string | null;
}): Promise<ActionResult> {
  const cur = await getDistributionQueueItemForUser(params);
  if (!cur) return { ok: false, reason: "not_found" };
  if (cur.queueStatus === "published" || cur.queueStatus === "archived") {
    return { ok: true, reason: "no_op_terminal", row: cur };
  }
  try {
    const db = await getDb();
    await db
      .update(bentleyDistributionQueue)
      .set({
        retestEligibleAt: new Date(),
        lastOptimizationAction: "cadence_retest",
        workflowNote: params.note?.slice(0, 8000) ?? cur.workflowNote,
        updatedAt: new Date(),
      })
      .where(eq(bentleyDistributionQueue.id, params.queueId));
    const next = await getDistributionQueueItemForUser(params);
    return { ok: true, row: next ?? cur };
  } catch (e) {
    console.error("[distribution-queue-actions] retest mark failed", e);
    return { ok: false, reason: "db_error" };
  }
}

export async function markDistributionQueueStale(params: {
  userId: string;
  clientId: string;
  trustId: string;
  queueId: string;
  note?: string | null;
}): Promise<ActionResult> {
  const cur = await getDistributionQueueItemForUser(params);
  if (!cur) return { ok: false, reason: "not_found" };
  if (cur.queueStatus === "published" || cur.queueStatus === "archived") {
    return { ok: true, reason: "no_op_terminal", row: cur };
  }
  try {
    const db = await getDb();
    await db
      .update(bentleyDistributionQueue)
      .set({
        staleAfterAt: new Date(),
        lastOptimizationAction: "cadence_stale",
        workflowNote: params.note?.slice(0, 8000) ?? cur.workflowNote,
        updatedAt: new Date(),
      })
      .where(eq(bentleyDistributionQueue.id, params.queueId));
    const next = await getDistributionQueueItemForUser(params);
    return { ok: true, row: next ?? cur };
  } catch (e) {
    console.error("[distribution-queue-actions] stale mark failed", e);
    return { ok: false, reason: "db_error" };
  }
}

export async function markDistributionQueueCadenceRetry(params: {
  userId: string;
  clientId: string;
  trustId: string;
  queueId: string;
  note?: string | null;
}): Promise<ActionResult> {
  const cur = await getDistributionQueueItemForUser(params);
  if (!cur) return { ok: false, reason: "not_found" };
  if (cur.queueStatus !== "failed") return { ok: true, reason: "no_op_not_failed", row: cur };
  try {
    const db = await getDb();
    await db
      .update(bentleyDistributionQueue)
      .set({
        lastOptimizationAction: "cadence_retry",
        workflowNote: params.note?.slice(0, 8000) ?? cur.workflowNote,
        updatedAt: new Date(),
      })
      .where(eq(bentleyDistributionQueue.id, params.queueId));
    const next = await getDistributionQueueItemForUser(params);
    return { ok: true, row: next ?? cur };
  } catch (e) {
    console.error("[distribution-queue-actions] cadence retry mark failed", e);
    return { ok: false, reason: "db_error" };
  }
}

export async function markDistributionQueueCadenceBlocked(params: {
  userId: string;
  clientId: string;
  trustId: string;
  queueId: string;
  note?: string | null;
}): Promise<ActionResult> {
  const cur = await getDistributionQueueItemForUser(params);
  if (!cur) return { ok: false, reason: "not_found" };
  try {
    const db = await getDb();
    await db
      .update(bentleyDistributionQueue)
      .set({
        lastOptimizationAction: "cadence_blocked_connector",
        workflowNote: params.note?.slice(0, 8000) ?? cur.workflowNote,
        updatedAt: new Date(),
      })
      .where(eq(bentleyDistributionQueue.id, params.queueId));
    const next = await getDistributionQueueItemForUser(params);
    return { ok: true, row: next ?? cur };
  } catch (e) {
    console.error("[distribution-queue-actions] cadence blocked mark failed", e);
    return { ok: false, reason: "db_error" };
  }
}

export async function rescheduleDistributionQueueItem(params: {
  userId: string;
  clientId: string;
  trustId: string;
  queueId: string;
  scheduledFor: Date;
}): Promise<ActionResult> {
  return scheduleDistributionQueueItem(params);
}
