/**
 * Persistent approval queue + approve/reject/expire flows for autonomous actions.
 */

import crypto from "crypto";
import { and, desc, eq, isNotNull, lte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bentleyAutonomousApprovalRequests } from "@/lib/db/schema";
import type { BentleyAutonomousCandidate } from "@/lib/revenue-os/autonomous-candidates";
import { executeBentleyAutonomousCandidate } from "@/lib/revenue-os/autonomous-candidate-execute";
import { writeBentleyAutonomousAuditEntry } from "@/lib/revenue-os/autonomous-audit";
import { insertNotificationEvent } from "@/lib/revenue-os/notification-db";
import type { EvaluateBentleyAutonomousThresholdsResult } from "@/lib/revenue-os/autonomous-thresholds";

export type ApprovalRequestRow = typeof bentleyAutonomousApprovalRequests.$inferSelect;

export type CreateApprovalRequestDecisionInput = {
  userId: string;
  autonomousRunId?: string | null;
  candidate: BentleyAutonomousCandidate;
  evaluation: EvaluateBentleyAutonomousThresholdsResult;
  policyId?: string;
  /** Default 7 days */
  expiresInHours?: number;
};

export type CreateApprovalRequestsFromDecisionsInput = {
  decisions: CreateApprovalRequestDecisionInput[];
  dryRun?: boolean;
};

export async function createApprovalRequestsFromDecisions(
  input: CreateApprovalRequestsFromDecisionsInput
): Promise<{ created: ApprovalRequestRow[]; ids: string[] }> {
  if (input.dryRun) {
    return { created: [], ids: [] };
  }
  const created: ApprovalRequestRow[] = [];
  const ids: string[] = [];
  for (const d of input.decisions) {
    const uid = String(d.userId).trim();
    if (!uid) continue;
    const id = crypto.randomUUID();
    const expiresInMs = (d.expiresInHours ?? 24 * 7) * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + expiresInMs);
    const decisionPayload = {
      candidate: d.candidate,
      evaluation: d.evaluation,
      policyId: d.policyId,
    };
    try {
      const db = await getDb();
      await db.insert(bentleyAutonomousApprovalRequests).values({
        id,
        autonomousRunId: d.autonomousRunId ?? null,
        userId: uid,
        clientId: d.candidate.scope.clientId,
        trustId: d.candidate.scope.trustId,
        actionType: d.candidate.actionType,
        approvalStatus: "pending",
        severity: d.evaluation.severity,
        reason: d.candidate.reason.slice(0, 8000),
        rationaleJson: { lines: d.evaluation.rationale },
        decisionPayloadJson: decisionPayload as unknown as Record<string, unknown>,
        targetIdsJson: d.candidate.targetIds,
        requestedAt: new Date(),
        expiresAt,
      });
      const row = await getBentleyApprovalRequestById({ userId: uid, id });
      if (row) {
        created.push(row);
        ids.push(id);
      }
    } catch (e) {
      console.warn("[autonomous-approval-queue] insert failed", e);
    }
  }
  return { created, ids };
}

export async function getBentleyApprovalRequestById(input: {
  userId: string;
  id: string;
}): Promise<ApprovalRequestRow | null> {
  const uid = String(input.userId).trim();
  const id = String(input.id).trim();
  if (!uid || !id) return null;
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(bentleyAutonomousApprovalRequests)
      .where(and(eq(bentleyAutonomousApprovalRequests.userId, uid), eq(bentleyAutonomousApprovalRequests.id, id)))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export type ListBentleyApprovalRequestsInput = {
  userId: string;
  clientId?: string;
  trustId?: string;
  approvalStatus?: string;
  actionType?: string;
  limit?: number;
};

export async function listBentleyApprovalRequests(
  input: ListBentleyApprovalRequestsInput
): Promise<ApprovalRequestRow[]> {
  const uid = String(input.userId).trim();
  if (!uid) return [];
  const limit = Math.min(200, Math.max(1, input.limit ?? 60));
  try {
    const db = await getDb();
    const c = input.clientId?.trim() ?? "";
    const t = input.trustId?.trim() ?? "";
    const conds = [eq(bentleyAutonomousApprovalRequests.userId, uid)];
    if (c) conds.push(eq(bentleyAutonomousApprovalRequests.clientId, c));
    if (t) conds.push(eq(bentleyAutonomousApprovalRequests.trustId, t));
    if (input.approvalStatus?.trim()) {
      conds.push(eq(bentleyAutonomousApprovalRequests.approvalStatus, input.approvalStatus.trim()));
    }
    if (input.actionType?.trim()) {
      conds.push(eq(bentleyAutonomousApprovalRequests.actionType, input.actionType.trim()));
    }
    const whereClause = conds.length === 1 ? conds[0]! : and(...conds);
    return await db
      .select()
      .from(bentleyAutonomousApprovalRequests)
      .where(whereClause)
      .orderBy(desc(bentleyAutonomousApprovalRequests.requestedAt))
      .limit(limit);
  } catch (e) {
    console.warn("[autonomous-approval-queue] list failed", e);
    return [];
  }
}

function parseDecisionPayload(row: ApprovalRequestRow): {
  candidate: BentleyAutonomousCandidate;
  evaluation?: EvaluateBentleyAutonomousThresholdsResult;
} | null {
  const raw = row.decisionPayloadJson;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const cand = o.candidate as BentleyAutonomousCandidate | undefined;
  if (!cand || typeof cand !== "object") return null;
  return {
    candidate: cand,
    evaluation: o.evaluation as EvaluateBentleyAutonomousThresholdsResult | undefined,
  };
}

async function emitApprovalDecisionNotification(params: {
  userId: string;
  candidate: BentleyAutonomousCandidate;
  eventType: "autonomous_action_approved" | "autonomous_action_rejected" | "autonomous_action_expired";
  title: string;
  body: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const scope = params.candidate.scope;
  await insertNotificationEvent({
    userId: params.userId,
    clientId: scope.clientId,
    trustId: scope.trustId,
    sourceType: "bentley_autonomous",
    eventType: params.eventType,
    severity: params.eventType === "autonomous_action_rejected" ? "warning" : "info",
    title: params.title.slice(0, 512),
    body: params.body,
    eventPayloadJson: params.payload,
    dedupeKey: `${params.eventType}:${params.userId}:${params.candidate.actionType}:${Date.now()}`.slice(0, 191),
  });
}

export async function approveBentleyApprovalRequest(input: {
  userId: string;
  approvalRequestId: string;
  reviewedByUserId: string;
  reviewNote?: string | null;
}): Promise<{
  ok: boolean;
  reason?: string;
  dispatch?: { ok: boolean; reason?: string };
}> {
  const uid = String(input.userId).trim();
  const rid = String(input.approvalRequestId).trim();
  if (!uid || !rid) return { ok: false, reason: "invalid_input" };

  const row = await getBentleyApprovalRequestById({ userId: uid, id: rid });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.approvalStatus !== "pending") {
    return { ok: false, reason: "already_handled" };
  }

  const parsed = parseDecisionPayload(row);
  if (!parsed) return { ok: false, reason: "invalid_decision_payload" };

  let dispatch: { ok: boolean; reason?: string } = { ok: false };
  try {
    dispatch = await executeBentleyAutonomousCandidate({
      userId: uid,
      candidate: parsed.candidate,
      dryRun: false,
    });
  } catch (e) {
    dispatch = { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }

  if (!dispatch.ok) {
    await writeBentleyAutonomousAuditEntry({
      userId: uid,
      clientId: row.clientId ?? "",
      trustId: row.trustId ?? "",
      sourceType: "approval_queue",
      actionType: row.actionType,
      actionStatus: "failed",
      relatedRunId: row.autonomousRunId,
      relatedApprovalRequestId: rid,
      targetIdsJson: row.targetIdsJson as string[] | null,
      actionPayloadJson: { phase: "approve_dispatch" },
      resultPayloadJson: { dispatch },
      rationaleJson: { note: "Dispatch failed during approve — request left pending." },
    });
    return { ok: false, reason: dispatch.reason ?? "dispatch_failed", dispatch };
  }

  try {
    const db = await getDb();
    await db
      .update(bentleyAutonomousApprovalRequests)
      .set({
        approvalStatus: "approved",
        reviewedAt: new Date(),
        reviewedByUserId: String(input.reviewedByUserId),
        reviewNote: input.reviewNote?.slice(0, 2000) ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(bentleyAutonomousApprovalRequests.id, rid), eq(bentleyAutonomousApprovalRequests.userId, uid)));

    await writeBentleyAutonomousAuditEntry({
      userId: uid,
      clientId: row.clientId ?? "",
      trustId: row.trustId ?? "",
      sourceType: "approval_queue",
      actionType: row.actionType,
      actionStatus: "approved",
      relatedRunId: row.autonomousRunId,
      relatedApprovalRequestId: rid,
      targetIdsJson: row.targetIdsJson as string[] | null,
      resultPayloadJson: { dispatch },
    });
    await writeBentleyAutonomousAuditEntry({
      userId: uid,
      clientId: row.clientId ?? "",
      trustId: row.trustId ?? "",
      sourceType: "approval_queue",
      actionType: row.actionType,
      actionStatus: "executed",
      relatedRunId: row.autonomousRunId,
      relatedApprovalRequestId: rid,
      targetIdsJson: row.targetIdsJson as string[] | null,
      resultPayloadJson: { dispatch },
    });

    await emitApprovalDecisionNotification({
      userId: uid,
      candidate: parsed.candidate,
      eventType: "autonomous_action_approved",
      title: `Approved: ${row.actionType}`,
      body: input.reviewNote?.slice(0, 400) ?? "Autonomous action approved and executed.",
      payload: { approvalRequestId: rid, dispatch },
    });

    return { ok: true, dispatch };
  } catch (e) {
    console.warn("[autonomous-approval-queue] approve failed", e);
    return { ok: false, reason: "db_error", dispatch };
  }
}

export async function rejectBentleyApprovalRequest(input: {
  userId: string;
  approvalRequestId: string;
  reviewedByUserId: string;
  reviewNote?: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  const uid = String(input.userId).trim();
  const rid = String(input.approvalRequestId).trim();
  if (!uid || !rid) return { ok: false, reason: "invalid_input" };

  const row = await getBentleyApprovalRequestById({ userId: uid, id: rid });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.approvalStatus !== "pending") {
    return { ok: false, reason: "already_handled" };
  }

  const parsed = parseDecisionPayload(row);

  try {
    const db = await getDb();
    await db
      .update(bentleyAutonomousApprovalRequests)
      .set({
        approvalStatus: "rejected",
        reviewedAt: new Date(),
        reviewedByUserId: String(input.reviewedByUserId),
        reviewNote: input.reviewNote?.slice(0, 2000) ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(bentleyAutonomousApprovalRequests.id, rid), eq(bentleyAutonomousApprovalRequests.userId, uid)));

    await writeBentleyAutonomousAuditEntry({
      userId: uid,
      clientId: row.clientId ?? "",
      trustId: row.trustId ?? "",
      sourceType: "approval_queue",
      actionType: row.actionType,
      actionStatus: "rejected",
      relatedRunId: row.autonomousRunId,
      relatedApprovalRequestId: rid,
      targetIdsJson: row.targetIdsJson as string[] | null,
      rationaleJson: { reviewNote: input.reviewNote ?? null },
    });

    if (parsed) {
      await emitApprovalDecisionNotification({
        userId: uid,
        candidate: parsed.candidate,
        eventType: "autonomous_action_rejected",
        title: `Rejected: ${row.actionType}`,
        body: input.reviewNote?.slice(0, 400) ?? "Autonomous action rejected.",
        payload: { approvalRequestId: rid },
      });
    }

    return { ok: true };
  } catch (e) {
    console.warn("[autonomous-approval-queue] reject failed", e);
    return { ok: false, reason: "db_error" };
  }
}

export async function expireBentleyApprovalRequests(input: {
  userId?: string;
  /** When set, only expire for this user. */
  dryRun?: boolean;
}): Promise<{ expiredCount: number; ids: string[] }> {
  if (input.dryRun) return { expiredCount: 0, ids: [] };
  const now = new Date();
  try {
    const db = await getDb();
    const uid = input.userId?.trim();
    const conds = [
      eq(bentleyAutonomousApprovalRequests.approvalStatus, "pending"),
      isNotNull(bentleyAutonomousApprovalRequests.expiresAt),
      lte(bentleyAutonomousApprovalRequests.expiresAt, now),
    ];
    if (uid) conds.push(eq(bentleyAutonomousApprovalRequests.userId, uid));
    const pending = await db
      .select()
      .from(bentleyAutonomousApprovalRequests)
      .where(and(...conds))
      .limit(500);

    const ids: string[] = [];
    for (const row of pending) {
      await db
        .update(bentleyAutonomousApprovalRequests)
        .set({ approvalStatus: "expired", updatedAt: new Date() })
        .where(eq(bentleyAutonomousApprovalRequests.id, row.id));

      await writeBentleyAutonomousAuditEntry({
        userId: row.userId,
        clientId: row.clientId ?? "",
        trustId: row.trustId ?? "",
        sourceType: "system",
        actionType: row.actionType,
        actionStatus: "expired",
        relatedRunId: row.autonomousRunId,
        relatedApprovalRequestId: row.id,
        rationaleJson: { expiresAt: row.expiresAt?.toISOString() ?? null },
      });

      const parsed = parseDecisionPayload(row);
      if (parsed) {
        await emitApprovalDecisionNotification({
          userId: row.userId,
          candidate: parsed.candidate,
          eventType: "autonomous_action_expired",
          title: `Expired: ${row.actionType}`,
          body: "Approval window elapsed.",
          payload: { approvalRequestId: row.id },
        });
      }
      ids.push(row.id);
    }

    return { expiredCount: ids.length, ids };
  } catch (e) {
    console.warn("[autonomous-approval-queue] expire failed", e);
    return { expiredCount: 0, ids: [] };
  }
}
