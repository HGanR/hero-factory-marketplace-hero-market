/**
 * Proactive lines merged into GrowthGuidance + operator API (exceptions, automation schedule).
 */

import {
  buildBentleyOperatorOverview,
  type BentleyOperatorOverview,
} from "@/lib/revenue-os/operator-intelligence";
import { detectBentleyExceptions } from "@/lib/revenue-os/exception-detection";
import { listAutomationPoliciesForUser } from "@/lib/revenue-os/automation-policies-db";
import type { GrowthGuidance } from "@/lib/revenue-os/market-sweep-schema";

export type ProactiveAutomationGuidance = {
  criticalExceptionCount: number;
  topEscalationLine?: string;
  overdueAutomationSummary?: string;
  nextScheduledAutomationLine?: string;
  reportStatusLine?: string;
};

export async function buildProactiveAutomationGuidance(input: {
  userId: string;
  clientId?: string;
  trustId?: string;
  /** When already computed (e.g. operator summary), avoids a second overview fetch. */
  overview?: BentleyOperatorOverview | null;
}): Promise<ProactiveAutomationGuidance> {
  const uid = String(input.userId).trim();
  if (!uid) {
    return {
      criticalExceptionCount: 0,
      reportStatusLine: "Sign in to load automation and exception state.",
    };
  }

  const filters = {
    clientIds: input.clientId ? [input.clientId] : undefined,
    trustIds: input.trustId ? [input.trustId] : undefined,
  };

  const overview =
    input.overview ??
    (await buildBentleyOperatorOverview({ userId: uid, ...filters }));
  const ex = detectBentleyExceptions({ overview });
  const policies = await listAutomationPoliciesForUser({
    userId: uid,
    clientId: input.clientId,
    trustId: input.trustId,
  });

  const nowMs = Date.now();
  const enabled = policies.filter((p) => p.isEnabled);
  const overdue = enabled.filter((p) => p.nextRunAt && p.nextRunAt.getTime() < nowMs);
  const nextTimes = enabled
    .map((p) => p.nextRunAt?.getTime())
    .filter((t): t is number => t != null && !Number.isNaN(t));
  const nextMin = nextTimes.length ? Math.min(...nextTimes) : null;

  let overdueAutomationSummary: string | undefined;
  if (overdue.length) {
    overdueAutomationSummary = `${overdue.length} automation policy(ies) overdue (next run passed).`;
  }

  let nextScheduledAutomationLine: string | undefined;
  if (nextMin != null) {
    nextScheduledAutomationLine = `Next scheduled automation window: ${new Date(nextMin).toISOString().slice(0, 16)} UTC.`;
  } else if (enabled.length && !nextTimes.length) {
    nextScheduledAutomationLine = "Policies enabled — set schedules (next_run_at) for predictable runs.";
  }

  const topEscalationLine =
    ex.recommendedEscalations[0] ??
    (ex.criticalExceptions[0]?.message
      ? `Critical: ${ex.criticalExceptions[0].message}`
      : undefined);

  const weeklyOn = policies.some((p) => p.isEnabled && p.policyType === "weekly_executive_report");
  const dailyOn = policies.some((p) => p.isEnabled && p.policyType === "daily_operator_summary");

  const reportStatusLine = [
    weeklyOn ? "Weekly executive report policy active." : "",
    dailyOn ? "Daily operator summary policy active." : "",
    !weeklyOn && !dailyOn ? "No report automation policies enabled." : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 400);

  return {
    criticalExceptionCount: ex.criticalExceptions.length,
    topEscalationLine,
    overdueAutomationSummary,
    nextScheduledAutomationLine,
    reportStatusLine: reportStatusLine || undefined,
  };
}

export function mergeProactiveAutomationIntoGrowthGuidance(
  base: GrowthGuidance,
  proactive: ProactiveAutomationGuidance
): GrowthGuidance {
  return {
    ...base,
    bentleyCriticalExceptionCount: proactive.criticalExceptionCount,
    bentleyTopEscalationLine: proactive.topEscalationLine,
    bentleyOverdueAutomationSummary: proactive.overdueAutomationSummary,
    bentleyNextScheduledAutomationLine: proactive.nextScheduledAutomationLine,
    bentleyReportStatusLine: proactive.reportStatusLine,
  };
}
