/**
 * Operational exception detection from Bentley operator overview + aggregates.
 */

import type { BentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";

export type BentleyException = {
  code: string;
  severity: "critical" | "warning";
  message: string;
  workspaceHint?: string;
};

export type DetectBentleyExceptionsInput = {
  overview: BentleyOperatorOverview;
  thresholds?: {
    handoffReadyCritical?: number;
    handoffReadyWarning?: number;
    failedPublishCritical?: number;
    unsyncedCritical?: number;
    blockedTargetsCritical?: number;
    staleBacklogCritical?: number;
    promotionIdleCritical?: number;
    cadenceStaleHours?: number;
    objectionClusterWarning?: number;
  };
};

const DEFAULTS = {
  handoffReadyCritical: 8,
  handoffReadyWarning: 3,
  failedPublishCritical: 3,
  unsyncedCritical: 5,
  blockedTargetsCritical: 6,
  staleBacklogCritical: 12,
  promotionIdleCritical: 2,
  cadenceStaleHours: 48,
  objectionClusterWarning: 3,
};

export type DetectBentleyExceptionsResult = {
  criticalExceptions: BentleyException[];
  warningExceptions: BentleyException[];
  exceptionSummary: string;
  recommendedEscalations: string[];
};

export function detectBentleyExceptions(input: DetectBentleyExceptionsInput): DetectBentleyExceptionsResult {
  const t = { ...DEFAULTS, ...input.thresholds };
  const o = input.overview;
  const g = o.globalSummary;
  const critical: BentleyException[] = [];
  const warning: BentleyException[] = [];

  const push = (b: BentleyException) => {
    if (b.severity === "critical") critical.push(b);
    else warning.push(b);
  };

  if (g.totalHandoffReadyLeads >= t.handoffReadyCritical) {
    push({
      code: "handoff_backlog_critical",
      severity: "critical",
      message: `${g.totalHandoffReadyLeads} handoff-ready leads need review.`,
    });
  } else if (g.totalHandoffReadyLeads >= t.handoffReadyWarning) {
    push({
      code: "handoff_backlog_warning",
      severity: "warning",
      message: `${g.totalHandoffReadyLeads} handoff-ready lead(s) awaiting routing.`,
    });
  }

  if (g.totalFailedPublishes >= t.failedPublishCritical) {
    push({
      code: "publish_failures",
      severity: "critical",
      message: `${g.totalFailedPublishes} failed publish(es) — retry or revise creative.`,
    });
  } else if (g.totalFailedPublishes > 0) {
    push({
      code: "publish_failures_light",
      severity: "warning",
      message: `${g.totalFailedPublishes} failed publish(es).`,
    });
  }

  if (g.totalUnsyncedPublished >= t.unsyncedCritical) {
    push({
      code: "unsynced_metrics",
      severity: "critical",
      message: `${g.totalUnsyncedPublished} published row(s) missing performance sync.`,
    });
  } else if (g.totalUnsyncedPublished > 2) {
    push({
      code: "unsynced_metrics_light",
      severity: "warning",
      message: `${g.totalUnsyncedPublished} published asset(s) not yet synced.`,
    });
  }

  if (g.totalBlockedTargets >= t.blockedTargetsCritical) {
    push({
      code: "connector_gap_severe",
      severity: "critical",
      message: `${g.totalBlockedTargets} connector-blocked target(s) — OAuth or manual path.`,
    });
  } else if (g.totalBlockedTargets > 0) {
    push({
      code: "connector_gap",
      severity: "warning",
      message: `${g.totalBlockedTargets} blocked routing target(s).`,
    });
  }

  const staleTotal = o.workspaceSummaries.reduce((a, s) => a + s.staleBacklogCount, 0);
  if (staleTotal >= t.staleBacklogCritical) {
    push({
      code: "stale_overload",
      severity: "critical",
      message: `${staleTotal} stale queue item(s) across workspaces.`,
    });
  } else if (staleTotal > 6) {
    push({
      code: "stale_backlog",
      severity: "warning",
      message: `${staleTotal} stale backlog item(s).`,
    });
  }

  const promoteTotal = o.workspaceSummaries.reduce((a, s) => a + s.promotionReadyCount, 0);
  if (promoteTotal >= t.promotionIdleCritical) {
    push({
      code: "winners_unpromoted",
      severity: "warning",
      message: `${promoteTotal} cadence-promoted asset(s) not yet published.`,
    });
  }

  const top = o.prioritization.topOpportunityWorkspace;
  if (top?.workspace.clientId) {
    const topWs = o.workspaceSummaries.find(
      (w) => w.workspace.clientId === top.workspace.clientId && w.workspace.trustId === top.workspace.trustId
    );
    if (topWs && topWs.blockedConnectorTargets >= 3) {
      push({
        code: "priority_workspace_connector_gap",
        severity: "critical",
        message: `Top-opportunity workspace has ${topWs.blockedConnectorTargets} blocked target(s).`,
        workspaceHint: `${top.workspace.clientId}/${top.workspace.trustId}`,
      });
    }
  }

  const now = Date.now();
  const staleMs = t.cadenceStaleHours * 60 * 60 * 1000;
  for (const ws of o.workspaceSummaries) {
    if (!ws.lastCadenceRunAt) continue;
    const last = new Date(ws.lastCadenceRunAt).getTime();
    if (Number.isNaN(last)) continue;
    if (now - last > staleMs && ws.queueTotal > 0) {
      push({
        code: "cadence_stale",
        severity: "warning",
        message: `Cadence not run recently for workspace ${ws.workspace.clientId || "default"}.`,
        workspaceHint: `${ws.workspace.clientId}/${ws.workspace.trustId}`,
      });
      break;
    }
  }

  const leadSignalsTotal = o.workspaceSummaries.reduce((a, s) => a + s.leadSignalTotal, 0);
  if (leadSignalsTotal >= t.objectionClusterWarning * 2 && g.totalHandoffReadyLeads < 2) {
    push({
      code: "objection_clusters_unaddressed",
      severity: "warning",
      message: "Lead signals show objection/trust themes — add or schedule response assets.",
    });
  }

  const exceptionSummary = [
    critical.length ? `${critical.length} critical` : "",
    warning.length ? `${warning.length} warning` : "",
  ]
    .filter(Boolean)
    .join(", ")
    .slice(0, 500);

  const recommendedEscalations: string[] = [];
  if (critical.some((c) => c.code === "handoff_backlog_critical")) {
    recommendedEscalations.push("Route or dismiss handoff-ready leads today.");
  }
  if (critical.some((c) => c.code === "publish_failures")) {
    recommendedEscalations.push("Retry failed publishes or unblock creative.");
  }
  if (critical.some((c) => c.code === "connector_gap_severe" || c.code === "priority_workspace_connector_gap")) {
    recommendedEscalations.push("Connect OAuth or use manual export for blocked platforms.");
  }

  return {
    criticalExceptions: critical,
    warningExceptions: warning,
    exceptionSummary: exceptionSummary || "No material exceptions detected.",
    recommendedEscalations,
  };
}
