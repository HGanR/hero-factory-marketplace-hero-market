/**
 * Normalized notification events from Bentley proactive state (no delivery).
 */

import type { BentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import type { DetectBentleyExceptionsResult } from "@/lib/revenue-os/exception-detection";
import type { ProactiveAutomationGuidance } from "@/lib/revenue-os/proactive-automation-guidance";

export type NotificationSeverity = "info" | "warning" | "critical";

export type BentleyNotificationScope = {
  clientId: string;
  trustId: string;
};

export type BentleyNotificationEventDraft = {
  eventType: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  sourceType: string;
  scope: BentleyNotificationScope;
  dedupeKey: string;
  recommendedAction?: string;
  deepLinkHints?: Record<string, string>;
  eventPayloadJson?: Record<string, unknown>;
};

export type BuildBentleyNotificationEventsInput = {
  userId: string;
  overview: BentleyOperatorOverview;
  exceptions: DetectBentleyExceptionsResult;
  proactiveGuidance?: ProactiveAutomationGuidance | null;
  /** Automation policies (for overdue nextRunAt). */
  automationPolicies?: Array<{
    id: string;
    policyType: string;
    nextRunAt: Date | null;
    isEnabled: boolean;
  }>;
  /** Set by caller when reports are ready — avoids re-running report builders. */
  reportHints?: {
    dailyOperatorReportReady?: boolean;
    weeklyExecutiveReportReady?: boolean;
  };
  /** Short digest headline from operator digest if available. */
  digestHeadline?: string | null;
};

const GLOBAL: BentleyNotificationScope = { clientId: "", trustId: "" };

function key(parts: string[]): string {
  return parts.join(":").slice(0, 191);
}

/**
 * Bridge: after automation or operator flow knows report availability, pass flags here (no report regeneration).
 */
export function buildReportReadyHintsFromFlags(input: {
  dailyOperatorReportReady?: boolean;
  weeklyExecutiveReportReady?: boolean;
}): NonNullable<BuildBentleyNotificationEventsInput["reportHints"]> {
  return {
    dailyOperatorReportReady: Boolean(input.dailyOperatorReportReady),
    weeklyExecutiveReportReady: Boolean(input.weeklyExecutiveReportReady),
  };
}

export function buildBentleyNotificationEvents(input: BuildBentleyNotificationEventsInput): BentleyNotificationEventDraft[] {
  const uid = String(input.userId).trim();
  const out: BentleyNotificationEventDraft[] = [];
  const g = input.overview.globalSummary;
  const o = input.overview;
  const ex = input.exceptions;

  for (const c of ex.criticalExceptions) {
    out.push({
      eventType: "critical_exception_detected",
      severity: "critical",
      title: `Critical: ${c.code}`,
      body: c.message,
      sourceType: "bentley_exception",
      scope: c.workspaceHint ? scopeFromHint(c.workspaceHint) : GLOBAL,
      dedupeKey: key(["crit", uid, c.code, c.workspaceHint ?? "global"]),
      recommendedAction: ex.recommendedEscalations[0],
      deepLinkHints: { area: "operator", tab: "exceptions" },
      eventPayloadJson: { code: c.code, workspaceHint: c.workspaceHint },
    });
  }

  for (const w of ex.warningExceptions.slice(0, 6)) {
    out.push({
      eventType: "operational_warning",
      severity: "warning",
      title: `Warning: ${w.code}`,
      body: w.message,
      sourceType: "bentley_exception",
      scope: w.workspaceHint ? scopeFromHint(w.workspaceHint) : GLOBAL,
      dedupeKey: key(["warn", uid, w.code, dayBucket()]),
      deepLinkHints: { area: "operator" },
      eventPayloadJson: { code: w.code },
    });
  }

  const pa = input.proactiveGuidance;
  if (pa?.overdueAutomationSummary?.trim()) {
    out.push({
      eventType: "overdue_automation_policy",
      severity: "warning",
      title: "Automation schedule overdue",
      body: pa.overdueAutomationSummary,
      sourceType: "bentley_automation",
      scope: GLOBAL,
      dedupeKey: key(["auto_overdue", uid, dayBucket()]),
      recommendedAction: "Review automation policies and run sweep or adjust schedule.",
      deepLinkHints: { area: "automations" },
    });
  }

  const now = Date.now();
  for (const pol of input.automationPolicies ?? []) {
    if (!pol.isEnabled || !pol.nextRunAt) continue;
    if (pol.nextRunAt.getTime() < now) {
      out.push({
        eventType: "overdue_automation_policy",
        severity: "warning",
        title: `Policy overdue: ${pol.policyType}`,
        body: `Policy ${pol.id} (${pol.policyType}) is past next run time.`,
        sourceType: "bentley_automation",
        scope: GLOBAL,
        dedupeKey: key(["pol_overdue", uid, pol.id, dayBucket()]),
        eventPayloadJson: { policyId: pol.id, policyType: pol.policyType },
      });
    }
  }

  if (g.totalHandoffReadyLeads >= 5) {
    out.push({
      eventType: "handoff_backlog_threshold",
      severity: g.totalHandoffReadyLeads >= 8 ? "critical" : "warning",
      title: "Handoff-ready lead backlog",
      body: `${g.totalHandoffReadyLeads} handoff-ready lead(s) — review routing.`,
      sourceType: "bentley_operator",
      scope: GLOBAL,
      dedupeKey: key(["handoff", uid, String(g.totalHandoffReadyLeads), dayBucket()]),
      recommendedAction: "Review lead handoffs queue.",
      deepLinkHints: { area: "leads" },
      eventPayloadJson: { count: g.totalHandoffReadyLeads },
    });
  }

  if (g.totalFailedPublishes >= 2) {
    out.push({
      eventType: "repeated_publish_failures",
      severity: g.totalFailedPublishes >= 3 ? "critical" : "warning",
      title: "Publish failures",
      body: `${g.totalFailedPublishes} failed publish(es) in scope.`,
      sourceType: "bentley_queue",
      scope: GLOBAL,
      dedupeKey: key(["pub_fail", uid, String(g.totalFailedPublishes), dayBucket()]),
      deepLinkHints: { area: "distribution" },
    });
  }

  const promoteTotal = o.workspaceSummaries.reduce((a, s) => a + s.promotionReadyCount, 0);
  if (promoteTotal >= 2) {
    out.push({
      eventType: "winners_not_promoted",
      severity: "warning",
      title: "Winning assets awaiting promotion",
      body: `${promoteTotal} cadence-promoted slot(s) not yet published.`,
      sourceType: "bentley_cadence",
      scope: GLOBAL,
      dedupeKey: key(["winners", uid, String(promoteTotal), dayBucket()]),
    });
  }

  const top = o.prioritization.topOpportunityWorkspace;
  if (top) {
    const ws = o.workspaceSummaries.find(
      (s) =>
        s.workspace.clientId === top.workspace.clientId && s.workspace.trustId === top.workspace.trustId
    );
    if (ws && ws.blockedConnectorTargets >= 3) {
      out.push({
        eventType: "severe_connector_gap_top_workspace",
        severity: "critical",
        title: "Connector gap on top-opportunity workspace",
        body: `${ws.blockedConnectorTargets} blocked target(s) on priority workspace.`,
        sourceType: "bentley_routing",
        scope: { clientId: ws.workspace.clientId, trustId: ws.workspace.trustId },
        dedupeKey: key(["conn_gap", uid, ws.workspace.clientId, ws.workspace.trustId, dayBucket()]),
        deepLinkHints: { area: "integrations" },
      });
    }
  }

  const rh = input.reportHints;
  if (rh?.weeklyExecutiveReportReady) {
    out.push({
      eventType: "weekly_executive_report_ready",
      severity: "info",
      title: "Weekly executive report available",
      body: "Your weekly executive report snapshot is ready to review.",
      sourceType: "bentley_report",
      scope: GLOBAL,
      dedupeKey: key(["weekly_report", uid, dayBucket()]),
      deepLinkHints: { area: "operator", report: "weekly" },
    });
  }
  if (rh?.dailyOperatorReportReady) {
    out.push({
      eventType: "daily_operator_report_ready",
      severity: "info",
      title: "Daily operator report available",
      body: "Daily operator summary is ready.",
      sourceType: "bentley_report",
      scope: GLOBAL,
      dedupeKey: key(["daily_report", uid, dayBucket()]),
      deepLinkHints: { area: "operator", report: "daily" },
    });
  }

  if (input.digestHeadline?.trim()) {
    out.push({
      eventType: "daily_operator_digest_available",
      severity: "info",
      title: "Operator digest",
      body: input.digestHeadline.trim().slice(0, 2000),
      sourceType: "bentley_digest",
      scope: GLOBAL,
      dedupeKey: key(["digest", uid, dayBucket()]),
    });
  }

  return out;
}

function dayBucket(): string {
  return new Date().toISOString().slice(0, 10);
}

function scopeFromHint(hint: string): BentleyNotificationScope {
  const [clientId = "", trustId = ""] = hint.split("/");
  return { clientId, trustId };
}

export function dedupeBentleyNotificationEvents(input: {
  events: BentleyNotificationEventDraft[];
  existingDedupeKeys: Set<string>;
}): BentleyNotificationEventDraft[] {
  const seen = new Set<string>();
  const out: BentleyNotificationEventDraft[] = [];
  for (const e of input.events) {
    const k = e.dedupeKey.trim();
    if (input.existingDedupeKeys.has(k)) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}
