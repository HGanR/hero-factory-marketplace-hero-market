/**
 * UI-ready payloads for autonomous audit timeline + stats.
 */

import {
  listBentleyAutonomousAuditEntries,
  summarizeBentleyAutonomousAudit,
  type AutonomousAuditRow,
} from "@/lib/revenue-os/autonomous-audit";

export type AutonomousAuditUiPayload = {
  timeline: Array<{
    id: string;
    createdAt: string | null;
    actionType: string;
    actionStatus: string;
    sourceType: string;
    workspaceLabel: string;
    summary: string;
  }>;
  statusCounts: Record<string, number>;
  approvalConversion: { approved: number; rejected: number; pendingSignal: string };
  failureBreakdown: Record<string, number>;
  topRejectedActionTypes: Array<{ actionType: string; count: number }>;
  recentExecuted: Array<{ id: string; actionType: string; createdAt: string | null }>;
  summaryLine: string;
  generatedAt: string;
};

function workspaceLabel(r: AutonomousAuditRow): string {
  const c = r.clientId?.trim() ?? "";
  const t = r.trustId?.trim() ?? "";
  if (!c && !t) return "Global";
  return `${c || "—"}/${t || "—"}`;
}

function timelineSummary(r: AutonomousAuditRow): string {
  const st = r.actionStatus;
  const at = r.actionType;
  return `${st} · ${at}`.slice(0, 200);
}

export async function buildAutonomousAuditUiPayload(input: {
  userId: string;
  generatedAt: string;
  clientId?: string;
  trustId?: string;
  sinceMs?: number;
}): Promise<AutonomousAuditUiPayload> {
  const uid = String(input.userId).trim();
  if (!uid) {
    return {
      timeline: [],
      statusCounts: {},
      approvalConversion: { approved: 0, rejected: 0, pendingSignal: "none" },
      failureBreakdown: {},
      topRejectedActionTypes: [],
      recentExecuted: [],
      summaryLine: "Sign in for audit trail.",
      generatedAt: input.generatedAt,
    };
  }

  const sinceMs = input.sinceMs ?? Date.now() - 14 * 24 * 60 * 60 * 1000;
  const entries = await listBentleyAutonomousAuditEntries({
    userId: uid,
    clientId: input.clientId,
    trustId: input.trustId,
    sinceMs,
    limit: 200,
  });

  const summary = await summarizeBentleyAutonomousAudit({
    userId: uid,
    clientId: input.clientId,
    trustId: input.trustId,
    sinceMs,
  });

  const timeline = entries.slice(0, 80).map((r) => ({
    id: r.id,
    createdAt: r.createdAt?.toISOString?.() ?? null,
    actionType: r.actionType,
    actionStatus: r.actionStatus,
    sourceType: r.sourceType,
    workspaceLabel: workspaceLabel(r),
    summary: timelineSummary(r),
  }));

  const statusCounts = { ...summary.byStatus };
  const approved = statusCounts.approved ?? 0;
  const rejected = statusCounts.rejected ?? 0;
  const approvalConversion = {
    approved,
    rejected,
    pendingSignal:
      approved + rejected > 0
        ? `${Math.round((approved / (approved + rejected)) * 100)}% approve rate (window)`
        : "no approvals in window",
  };

  const failureBreakdown: Record<string, number> = {};
  for (const r of entries) {
    if (r.actionStatus !== "failed") continue;
    failureBreakdown[r.actionType] = (failureBreakdown[r.actionType] ?? 0) + 1;
  }

  const rejectByType: Record<string, number> = {};
  for (const r of entries) {
    if (r.actionStatus !== "rejected") continue;
    rejectByType[r.actionType] = (rejectByType[r.actionType] ?? 0) + 1;
  }
  const topRejectedActionTypes = Object.entries(rejectByType)
    .map(([actionType, count]) => ({ actionType, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const recentExecuted = entries
    .filter((r) => r.actionStatus === "executed")
    .slice(0, 12)
    .map((r) => ({
      id: r.id,
      actionType: r.actionType,
      createdAt: r.createdAt?.toISOString?.() ?? null,
    }));

  return {
    timeline,
    statusCounts,
    approvalConversion,
    failureBreakdown,
    topRejectedActionTypes,
    recentExecuted,
    summaryLine: summary.summaryLine,
    generatedAt: input.generatedAt,
  };
}
