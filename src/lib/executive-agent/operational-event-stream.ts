import type {
  ExecutiveCommandEngineInput,
  OperationalEvent,
  OperationalEventStreamResult,
} from "@/lib/executive-agent/executive-command-types";

export function aggregateOperationalEventStream(
  input: ExecutiveCommandEngineInput
): OperationalEventStreamResult {
  const events: OperationalEvent[] = [];
  const now = new Date().toISOString();

  for (const s of input.kpi.snapshots) {
    if (s.approvalStatus === "pending") {
      events.push({
        id: `approval:${s.orderId}`,
        kind: "approval_pending",
        department: s.department,
        severity: s.daysInCurrentStage >= 7 ? "high" : "medium",
        summary: `Pending approval on ${s.department} order ${s.orderId.slice(0, 8)}…`,
        occurredAt: s.updatedAt ?? now,
        evidence: [{ source: "snapshots", detail: `Stage ${s.pipelineStage}, ${s.daysInCurrentStage}d dwell` }],
      });
    }
    if (s.daysInCurrentStage >= 10) {
      events.push({
        id: `stall:${s.orderId}`,
        kind: "order_stalled",
        department: s.department,
        severity: s.daysInCurrentStage >= 14 ? "critical" : "high",
        summary: `Stalled ${s.department} order at ${s.pipelineStage}`,
        occurredAt: s.updatedAt ?? now,
        evidence: [{ source: "snapshots", detail: `${s.daysInCurrentStage} days in stage` }],
      });
    }
    if (s.department === "SMART_TRUST" && s.daysInCurrentStage >= 8) {
      events.push({
        id: `gov:${s.orderId}`,
        kind: "governance_delay",
        department: "SMART_TRUST",
        severity: "high",
        summary: "SMART_TRUST governance delay signal",
        occurredAt: s.updatedAt ?? now,
        evidence: [{ source: "snapshots", detail: "Governance desk dwell" }],
      });
    }
    if (s.department === "REVENUE_OS" && (s.approvalStatus === "pending" || s.daysInCurrentStage >= 9)) {
      events.push({
        id: `campaign:${s.orderId}`,
        kind: "campaign_at_risk",
        department: "REVENUE_OS",
        severity: "medium",
        summary: "REVENUE_OS campaign degradation watch",
        occurredAt: s.updatedAt ?? now,
        evidence: [{ source: "snapshots", detail: s.pipelineStage }],
      });
    }
  }

  for (const t of input.tasks) {
    if (t.status === "blocked" || t.isBlocked) {
      events.push({
        id: `blocked:${t.id}`,
        kind: "task_blocked",
        department: t.department,
        severity: "medium",
        summary: `Blocked task: ${t.title.slice(0, 60)}`,
        occurredAt: t.updatedAt,
        evidence: [{ source: "tasks", detail: t.blockedReason ?? "dependency or desk block" }],
      });
    }
    if (t.isOverdue) {
      events.push({
        id: `overdue:${t.id}`,
        kind: "task_overdue",
        department: t.department,
        severity: "high",
        summary: `Overdue task: ${t.title.slice(0, 60)}`,
        occurredAt: t.updatedAt,
        evidence: [{ source: "tasks", detail: `Due ${t.dueAt ?? "unknown"}` }],
      });
    }
    const meta = input.metadataByTaskId.get(t.id);
    if (meta?.escalation?.status === "proposed") {
      events.push({
        id: `escalation:${t.id}`,
        kind: "escalation_proposed",
        department: t.department,
        severity: "high",
        summary: `Escalation proposed for task ${t.title.slice(0, 40)}`,
        occurredAt: meta.escalation.proposedAt,
        evidence: [{ source: "tasks", detail: `Level ${meta.escalation.level}` }],
      });
    }
  }

  for (const w of input.operatorWorkload) {
    if (w.balanceLabel === "overloaded") {
      events.push({
        id: `overload:${w.operatorId}`,
        kind: "operator_overload",
        department: w.department,
        severity: "high",
        summary: `${w.label} overloaded (load ${w.loadIndex})`,
        occurredAt: now,
        evidence: [{ source: "operators", detail: `${w.openTasks} open tasks` }],
      });
    }
  }

  const simRuns = input.auditActionTypes.filter((a) => a === "simulation_run").length;
  if (simRuns >= 3) {
    events.push({
      id: "audit:simulation_activity",
      kind: "audit_signal",
      department: null,
      severity: "watch",
      summary: "Elevated simulation review activity on desk",
      occurredAt: now,
      evidence: [{ source: "audit", detail: `${simRuns} simulation_run events` }],
    });
  }

  const severityRank = { critical: 4, high: 3, medium: 2, low: 1, watch: 0 };
  events.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);

  return {
    events: events.slice(0, 50),
    eventCount: events.length,
    criticalCount: events.filter((e) => e.severity === "critical").length,
    evidence: [{ source: "inference", detail: `${events.length} operational event(s) aggregated` }],
    advisoryOnly: true,
  };
}
