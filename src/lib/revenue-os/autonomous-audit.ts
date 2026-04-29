/**
 * Durable audit trail for autonomous decisions and outcomes.
 */

import crypto from "crypto";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bentleyAutonomousActionAudit } from "@/lib/db/schema";

export type AutonomousAuditRow = typeof bentleyAutonomousActionAudit.$inferSelect;

export type BentleyAutonomousAuditActionStatus =
  | "planned"
  | "approval_required"
  | "approved"
  | "rejected"
  | "executed"
  | "failed"
  | "skipped"
  | "expired"
  | "canceled";

export async function writeBentleyAutonomousAuditEntry(params: {
  userId: string;
  clientId?: string;
  trustId?: string;
  sourceType: string;
  actionType: string;
  actionStatus: BentleyAutonomousAuditActionStatus | string;
  relatedRunId?: string | null;
  relatedApprovalRequestId?: string | null;
  targetIdsJson?: unknown[] | Record<string, unknown> | null;
  actionPayloadJson?: Record<string, unknown> | null;
  resultPayloadJson?: Record<string, unknown> | null;
  rationaleJson?: Record<string, unknown> | null;
}): Promise<{ id: string; ok: boolean }> {
  const id = crypto.randomUUID();
  const uid = String(params.userId).trim();
  if (!uid) return { id, ok: false };
  try {
    const db = await getDb();
    await db.insert(bentleyAutonomousActionAudit).values({
      id,
      userId: uid,
      clientId: params.clientId ?? "",
      trustId: params.trustId ?? "",
      sourceType: params.sourceType.slice(0, 48),
      actionType: params.actionType.slice(0, 64),
      actionStatus: String(params.actionStatus).slice(0, 32),
      relatedRunId: params.relatedRunId ?? null,
      relatedApprovalRequestId: params.relatedApprovalRequestId ?? null,
      targetIdsJson: params.targetIdsJson ?? null,
      actionPayloadJson: params.actionPayloadJson ?? null,
      resultPayloadJson: params.resultPayloadJson ?? null,
      rationaleJson: params.rationaleJson ?? null,
    });
    return { id, ok: true };
  } catch (e) {
    console.warn("[autonomous-audit] write failed", e);
    return { id, ok: false };
  }
}

export type SummarizeBentleyAutonomousAuditInput = {
  userId: string;
  clientId?: string;
  trustId?: string;
  sinceMs?: number;
};

export type BentleyAutonomousAuditSummary = {
  total: number;
  byStatus: Record<string, number>;
  executedCount: number;
  failedCount: number;
  rejectedCount: number;
  approvalRequiredCount: number;
  summaryLine: string;
};

export async function summarizeBentleyAutonomousAudit(
  input: SummarizeBentleyAutonomousAuditInput
): Promise<BentleyAutonomousAuditSummary> {
  const uid = String(input.userId).trim();
  if (!uid) {
    return {
      total: 0,
      byStatus: {},
      executedCount: 0,
      failedCount: 0,
      rejectedCount: 0,
      approvalRequiredCount: 0,
      summaryLine: "No audit data.",
    };
  }
  const since = input.sinceMs != null ? new Date(input.sinceMs) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  try {
    const db = await getDb();
    const c = input.clientId?.trim() ?? "";
    const t = input.trustId?.trim() ?? "";
    const base = and(eq(bentleyAutonomousActionAudit.userId, uid), gte(bentleyAutonomousActionAudit.createdAt, since));
    const scope =
      c && t
        ? and(base, eq(bentleyAutonomousActionAudit.clientId, c), eq(bentleyAutonomousActionAudit.trustId, t))
        : c
          ? and(base, eq(bentleyAutonomousActionAudit.clientId, c))
          : t
            ? and(base, eq(bentleyAutonomousActionAudit.trustId, t))
            : base;

    const rows = await db
      .select({ actionStatus: bentleyAutonomousActionAudit.actionStatus })
      .from(bentleyAutonomousActionAudit)
      .where(scope)
      .limit(5000);

    const byStatus: Record<string, number> = {};
    for (const r of rows) {
      const k = r.actionStatus ?? "unknown";
      byStatus[k] = (byStatus[k] ?? 0) + 1;
    }
    const executedCount = byStatus.executed ?? 0;
    const failedCount = byStatus.failed ?? 0;
    const rejectedCount = byStatus.rejected ?? 0;
    const approvalRequiredCount = byStatus.approval_required ?? 0;
    const total = rows.length;
    return {
      total,
      byStatus,
      executedCount,
      failedCount,
      rejectedCount,
      approvalRequiredCount,
      summaryLine: `${total} audit entries in window; ${executedCount} executed, ${failedCount} failed, ${rejectedCount} rejected.`,
    };
  } catch (e) {
    console.warn("[autonomous-audit] summarize failed", e);
    return {
      total: 0,
      byStatus: {},
      executedCount: 0,
      failedCount: 0,
      rejectedCount: 0,
      approvalRequiredCount: 0,
      summaryLine: "Audit summary unavailable.",
    };
  }
}

export type ListBentleyAutonomousAuditEntriesInput = {
  userId: string;
  clientId?: string;
  trustId?: string;
  actionType?: string;
  actionStatus?: string;
  sinceMs?: number;
  untilMs?: number;
  limit?: number;
};

export async function listBentleyAutonomousAuditEntries(
  input: ListBentleyAutonomousAuditEntriesInput
): Promise<AutonomousAuditRow[]> {
  const uid = String(input.userId).trim();
  if (!uid) return [];
  const limit = Math.min(500, Math.max(1, input.limit ?? 80));
  try {
    const db = await getDb();
    const c = input.clientId?.trim() ?? "";
    const t = input.trustId?.trim() ?? "";
    const conds = [eq(bentleyAutonomousActionAudit.userId, uid)];
    if (input.sinceMs != null) {
      conds.push(gte(bentleyAutonomousActionAudit.createdAt, new Date(input.sinceMs)));
    }
    if (input.untilMs != null) {
      conds.push(lte(bentleyAutonomousActionAudit.createdAt, new Date(input.untilMs)));
    }
    if (c) conds.push(eq(bentleyAutonomousActionAudit.clientId, c));
    if (t) conds.push(eq(bentleyAutonomousActionAudit.trustId, t));
    if (input.actionType?.trim()) conds.push(eq(bentleyAutonomousActionAudit.actionType, input.actionType.trim()));
    if (input.actionStatus?.trim()) conds.push(eq(bentleyAutonomousActionAudit.actionStatus, input.actionStatus.trim()));

    const whereClause = conds.length === 1 ? conds[0]! : and(...conds);

    return await db
      .select()
      .from(bentleyAutonomousActionAudit)
      .where(whereClause)
      .orderBy(desc(bentleyAutonomousActionAudit.createdAt))
      .limit(limit);
  } catch (e) {
    console.warn("[autonomous-audit] list failed", e);
    return [];
  }
}
