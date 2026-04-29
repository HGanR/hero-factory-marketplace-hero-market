/**
 * Dashboard-ready payloads for policy-governed autonomous actions.
 */

import { listAutonomousPoliciesForUser, listAutonomousRunsForUser } from "@/lib/revenue-os/autonomous-policies-db";
import type { AutonomousActionGuidance } from "@/lib/revenue-os/market-sweep-schema";
import { buildAutonomousApprovalUiPayload } from "@/lib/revenue-os/autonomous-approval-ui";
import { buildAutonomousAuditUiPayload } from "@/lib/revenue-os/autonomous-audit-ui";
import { summarizeApprovalQueue, type BentleyAutonomousApprovalRequest } from "@/lib/revenue-os/autonomous-approvals";
import type { EvaluateBentleyAutonomousThresholdsResult } from "@/lib/revenue-os/autonomous-thresholds";
import type { BentleyAutonomousCandidate } from "@/lib/revenue-os/autonomous-candidates";

export type AutonomousDashboardUiPayload = {
  autoExecutedToday: number;
  approvalRequiredQueue: Array<{
    actionType: string;
    scope: string;
    reason: string;
    severity: string;
    runId?: string;
  }>;
  skippedByPolicy: number;
  failedRuns: number;
  policyCoverage: Array<{
    id: string;
    actionType: string;
    isEnabled: boolean;
    requiresApprovalAboveSeverity: string;
    maxDailyExecutions: number | null;
    cooldownMinutes: number | null;
  }>;
  actionTypeBreakdown: Record<string, number>;
  topApprovalCandidates: Array<{ actionType: string; scope: string; reason: string }>;
  generatedAt: string;
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export async function buildAutonomousDashboardUiPayload(input: {
  userId: string;
  generatedAt: string;
  /** Optional — when caller already has approval stubs. */
  approvalRequests?: BentleyAutonomousApprovalRequest[];
}): Promise<AutonomousDashboardUiPayload> {
  const uid = String(input.userId).trim();
  if (!uid) {
    return {
      autoExecutedToday: 0,
      approvalRequiredQueue: [],
      skippedByPolicy: 0,
      failedRuns: 0,
      policyCoverage: [],
      actionTypeBreakdown: {},
      topApprovalCandidates: [],
      generatedAt: input.generatedAt,
    };
  }

  const [policies, runs] = await Promise.all([
    listAutonomousPoliciesForUser({ userId: uid }),
    listAutonomousRunsForUser({ userId: uid, limit: 120 }),
  ]);

  const since = startOfUtcDay(new Date());
  let autoExecutedToday = 0;
  let skippedByPolicy = 0;
  let failedRuns = 0;
  const actionTypeBreakdown: Record<string, number> = {};

  const approvalRows: AutonomousDashboardUiPayload["approvalRequiredQueue"] = [];

  for (const r of runs) {
    const st = r.runStatus;
    const ra = r.startedAt instanceof Date ? r.startedAt : new Date(r.startedAt as unknown as string);
    if (ra >= since && st === "completed") {
      autoExecutedToday += r.executedCount ?? 0;
    }
    if (st === "approval_required") {
      approvalRows.push({
        actionType: r.actionType,
        scope: JSON.stringify(r.scopeJson ?? {}),
        reason: (r.decisionSummaryJson as { evaluation?: EvaluateBentleyAutonomousThresholdsResult } | null)?.evaluation?.rationale?.join(
          " "
        ) ?? "",
        severity: "warning",
        runId: r.id,
      });
    }
    if (st === "skipped") skippedByPolicy += 1;
    if (st === "failed") failedRuns += 1;
    actionTypeBreakdown[r.actionType] = (actionTypeBreakdown[r.actionType] ?? 0) + 1;
  }

  const ext = input.approvalRequests?.length
    ? summarizeApprovalQueue({ approvalRequests: input.approvalRequests })
    : null;

  const topApprovalCandidates = (ext?.samples ?? approvalRows.slice(0, 8)).map((s) => ({
    actionType: s.actionType,
    scope: s.scope,
    reason: s.reason.slice(0, 200),
  }));

  return {
    autoExecutedToday,
    approvalRequiredQueue: approvalRows.slice(0, 30),
    skippedByPolicy,
    failedRuns,
    policyCoverage: policies.map((p) => ({
      id: p.id,
      actionType: p.actionType,
      isEnabled: p.isEnabled,
      requiresApprovalAboveSeverity: p.requiresApprovalAboveSeverity,
      maxDailyExecutions: p.maxDailyExecutions,
      cooldownMinutes: p.cooldownMinutes,
    })),
    actionTypeBreakdown,
    topApprovalCandidates,
    generatedAt: input.generatedAt,
  };
}

export async function buildAutonomousGuidanceFromDashboard(input: {
  userId: string;
  generatedAt: string;
  clientId?: string;
  trustId?: string;
}): Promise<AutonomousActionGuidance> {
  const dash = await buildAutonomousDashboardUiPayload({
    userId: input.userId,
    generatedAt: input.generatedAt,
  });
  const [apprUi, auditUi] = await Promise.all([
    buildAutonomousApprovalUiPayload({
      userId: input.userId,
      generatedAt: input.generatedAt,
      clientId: input.clientId,
      trustId: input.trustId,
    }),
    buildAutonomousAuditUiPayload({
      userId: input.userId,
      generatedAt: input.generatedAt,
      clientId: input.clientId,
      trustId: input.trustId,
    }),
  ]);

  const n = dash.autoExecutedToday;
  const appr = apprUi.pendingApprovals.length;
  const fail = dash.failedRuns;
  const summary =
    appr > 0 || fail > 0 || n > 0
      ? `Autonomy: ${n} auto-executed today; ${appr} awaiting approval; ${fail} failed run(s).`
      : "Autonomy: no recent autonomous executions in scope.";
  const top =
    apprUi.actionPreviewCards[0] != null
      ? `Top approval: ${apprUi.actionPreviewCards[0].title} — ${apprUi.actionPreviewCards[0].subtitle.slice(0, 120)}`
      : dash.topApprovalCandidates[0] != null
        ? `Top approval: ${dash.topApprovalCandidates[0].actionType} — ${dash.topApprovalCandidates[0].reason.slice(0, 120)}`
        : undefined;

  const pending = apprUi.pendingApprovals.length;
  const expiring = apprUi.expiringSoon.length;
  const recentExec = auditUi.recentExecuted[0];
  const recentFail = auditUi.timeline.find((t) => t.actionStatus === "failed");

  return {
    bentleyAutonomousActionSummaryLine: summary,
    bentleyAutoExecutedCount: n,
    bentleyApprovalRequiredCount: appr,
    bentleyAutonomousFailureCount: fail,
    bentleyTopApprovalRequestLine: top,
    bentleyPendingApprovalCount: pending,
    bentleyExpiringApprovalCount: expiring,
    bentleyRecentAutonomousExecutionLine: recentExec
      ? `Last executed: ${recentExec.actionType} (${recentExec.createdAt ?? ""}).`
      : undefined,
    bentleyRecentAutonomousFailureLine: recentFail
      ? `Recent failure: ${recentFail.actionType} — ${recentFail.actionStatus}.`
      : undefined,
    bentleyApprovalQueueSummaryLine:
      pending > 0
        ? `${pending} autonomous action(s) awaiting approval${expiring > 0 ? `; ${expiring} expire soon` : ""}.`
        : "No pending autonomous approvals.",
    bentleyAuditTrailSummaryLine: auditUi.summaryLine,
  };
}
