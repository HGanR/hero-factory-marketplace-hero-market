/**
 * UI-ready payloads for the autonomous approval queue.
 */

import { listBentleyApprovalRequests, type ApprovalRequestRow } from "@/lib/revenue-os/autonomous-approval-queue";

export type AutonomousApprovalPendingItem = {
  id: string;
  actionType: string;
  severity: string;
  reason: string;
  workspaceLabel: string;
  requestedAt: string | null;
  expiresAt: string | null;
  preview: { targetIds: string[]; queueId?: string; leadSignalId?: string };
};

export type AutonomousApprovalUiPayload = {
  pendingApprovals: AutonomousApprovalPendingItem[];
  bySeverity: Record<string, AutonomousApprovalPendingItem[]>;
  byActionType: Record<string, number>;
  expiringSoon: Array<{ id: string; actionType: string; expiresAt: string | null }>;
  recentlyApproved: Array<{ id: string; actionType: string; reviewedAt: string | null }>;
  recentlyRejected: Array<{ id: string; actionType: string; reviewedAt: string | null }>;
  actionPreviewCards: Array<{
    id: string;
    title: string;
    subtitle: string;
    severity: string;
    workspaceLabel: string;
  }>;
  generatedAt: string;
};

function workspaceLabel(row: ApprovalRequestRow): string {
  const c = row.clientId?.trim() ?? "";
  const t = row.trustId?.trim() ?? "";
  if (!c && !t) return "Global";
  return `${c || "—"}/${t || "—"}`;
}

function previewFromRow(row: ApprovalRequestRow): {
  targetIds: string[];
  queueId?: string;
  leadSignalId?: string;
} {
  const t = row.targetIdsJson;
  const ids = Array.isArray(t) ? (t as string[]) : [];
  const dp = row.decisionPayloadJson as { candidate?: { queueId?: string; leadSignalId?: string } } | null;
  return {
    targetIds: ids,
    queueId: dp?.candidate?.queueId,
    leadSignalId: dp?.candidate?.leadSignalId,
  };
}

export async function buildAutonomousApprovalUiPayload(input: {
  userId: string;
  generatedAt: string;
  clientId?: string;
  trustId?: string;
}): Promise<AutonomousApprovalUiPayload> {
  const uid = String(input.userId).trim();
  if (!uid) {
    return {
      pendingApprovals: [],
      bySeverity: {},
      byActionType: {},
      expiringSoon: [],
      recentlyApproved: [],
      recentlyRejected: [],
      actionPreviewCards: [],
      generatedAt: input.generatedAt,
    };
  }

  const all = await listBentleyApprovalRequests({
    userId: uid,
    clientId: input.clientId,
    trustId: input.trustId,
    limit: 200,
  });

  const pending = all.filter((r) => r.approvalStatus === "pending");
  const now = Date.now();
  const soonMs = 48 * 60 * 60 * 1000;

  const pendingApprovals: AutonomousApprovalPendingItem[] = pending.map((r) => ({
    id: r.id,
    actionType: r.actionType,
    severity: r.severity,
    reason: (r.reason ?? "").slice(0, 2000),
    workspaceLabel: workspaceLabel(r),
    requestedAt: r.requestedAt?.toISOString?.() ?? null,
    expiresAt: r.expiresAt?.toISOString?.() ?? null,
    preview: previewFromRow(r),
  }));

  const bySeverity: Record<string, AutonomousApprovalPendingItem[]> = {};
  for (const p of pendingApprovals) {
    const k = p.severity || "info";
    if (!bySeverity[k]) bySeverity[k] = [];
    bySeverity[k].push(p);
  }

  const byActionType: Record<string, number> = {};
  for (const p of pendingApprovals) {
    byActionType[p.actionType] = (byActionType[p.actionType] ?? 0) + 1;
  }

  const expiringSoon = pending
    .filter((r) => r.expiresAt && new Date(r.expiresAt).getTime() - now < soonMs && new Date(r.expiresAt).getTime() > now)
    .map((r) => ({
      id: r.id,
      actionType: r.actionType,
      expiresAt: r.expiresAt?.toISOString?.() ?? null,
    }));

  const approved = all
    .filter((r) => r.approvalStatus === "approved")
    .slice(0, 15)
    .map((r) => ({
      id: r.id,
      actionType: r.actionType,
      reviewedAt: r.reviewedAt?.toISOString?.() ?? null,
    }));

  const rejected = all
    .filter((r) => r.approvalStatus === "rejected")
    .slice(0, 15)
    .map((r) => ({
      id: r.id,
      actionType: r.actionType,
      reviewedAt: r.reviewedAt?.toISOString?.() ?? null,
    }));

  const actionPreviewCards = pendingApprovals.slice(0, 24).map((p) => ({
    id: p.id,
    title: p.actionType.replace(/^auto_/, "").replace(/_/g, " "),
    subtitle: p.reason.slice(0, 180),
    severity: p.severity,
    workspaceLabel: p.workspaceLabel,
  }));

  return {
    pendingApprovals,
    bySeverity,
    byActionType,
    expiringSoon,
    recentlyApproved: approved,
    recentlyRejected: rejected,
    actionPreviewCards,
    generatedAt: input.generatedAt,
  };
}
