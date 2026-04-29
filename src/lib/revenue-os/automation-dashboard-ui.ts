/**
 * UI-ready widgets for automation + proactive operations.
 */

import type { AutomationPolicyRow, AutomationRunRow } from "@/lib/revenue-os/automation-policies-db";
import type { BentleyException } from "@/lib/revenue-os/exception-detection";

export type AutomationDashboardUiPayload = {
  enabledPolicies: Array<{
    id: string;
    policyType: string;
    clientId: string;
    trustId: string;
    isEnabled: boolean;
    lastRunAt: string | null;
    nextRunAt: string | null;
    overdue: boolean;
  }>;
  overdueRuns: Array<{ policyId: string; policyType: string; nextRunAt: string | null; line: string }>;
  recentAutomationResults: Array<{
    id: string;
    policyId: string;
    runStatus: string;
    startedAt: string | null;
    summaryHint: string;
  }>;
  criticalExceptions: Array<{ code: string; message: string }>;
  scheduledNextRuns: Array<{ policyId: string; policyType: string; nextRunAt: string | null }>;
  reportAvailability: {
    dailyOperatorReportReady: boolean;
    weeklyExecutiveReportReady: boolean;
    hint: string;
  };
  generatedAt: string;
};

function ts(d: Date | null | undefined): string | null {
  if (!d) return null;
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString();
  return null;
}

export function buildAutomationDashboardUiPayload(input: {
  policies: AutomationPolicyRow[];
  recentRuns: AutomationRunRow[];
  criticalExceptions: BentleyException[];
  generatedAt: string;
  nowMs?: number;
}): AutomationDashboardUiPayload {
  const nowMs = input.nowMs ?? Date.now();

  const enabledPolicies = input.policies
    .filter((p) => p.isEnabled)
    .map((p) => {
      const next = p.nextRunAt;
      const overdue = next != null && next.getTime() < nowMs;
      return {
        id: p.id,
        policyType: p.policyType,
        clientId: p.clientId,
        trustId: p.trustId,
        isEnabled: p.isEnabled,
        lastRunAt: ts(p.lastRunAt),
        nextRunAt: ts(p.nextRunAt),
        overdue,
      };
    });

  const overdueRuns = enabledPolicies
    .filter((p) => p.overdue)
    .map((p) => ({
      policyId: p.id,
      policyType: p.policyType,
      nextRunAt: p.nextRunAt,
      line: `${p.policyType} overdue — last scheduled ${p.nextRunAt ?? "—"}.`,
    }));

  const recentAutomationResults = input.recentRuns.slice(0, 20).map((r) => {
    const j = (r.runSummaryJson as Record<string, unknown> | null) ?? {};
    const hint =
      typeof j.message === "string"
        ? j.message.slice(0, 160)
        : typeof j.kind === "string"
          ? String(j.kind)
          : r.runStatus;
    return {
      id: r.id,
      policyId: r.policyId,
      runStatus: r.runStatus,
      startedAt: ts(r.startedAt),
      summaryHint: hint,
    };
  });

  const scheduledNextRuns = enabledPolicies
    .map((p) => ({
      policyId: p.id,
      policyType: p.policyType,
      nextRunAt: p.nextRunAt,
    }))
    .sort((a, b) => {
      const ta = a.nextRunAt ? new Date(a.nextRunAt).getTime() : Infinity;
      const tb = b.nextRunAt ? new Date(b.nextRunAt).getTime() : Infinity;
      return ta - tb;
    })
    .slice(0, 12);

  const hasWeekly = input.policies.some((p) => p.policyType === "weekly_executive_report" && p.isEnabled);
  const hasDaily = input.policies.some((p) => p.policyType === "daily_operator_summary" && p.isEnabled);

  return {
    enabledPolicies,
    overdueRuns,
    recentAutomationResults,
    criticalExceptions: input.criticalExceptions.slice(0, 12).map((e) => ({
      code: e.code,
      message: e.message,
    })),
    scheduledNextRuns,
    reportAvailability: {
      dailyOperatorReportReady: hasDaily,
      weeklyExecutiveReportReady: hasWeekly,
      hint: hasWeekly
        ? "Weekly executive policy enabled — report generated on schedule."
        : hasDaily
          ? "Daily operator summary policy enabled."
          : "Enable automation policies to generate scheduled reports.",
    },
    generatedAt: input.generatedAt,
  };
}
