import type { ExecutiveInterruption } from "@/lib/executive-agent/executive-presence-types";

export type InterruptionSourceInput = {
  topIncident: { title: string; severity: string; summary: string } | null;
  topAlerts: Array<{ title: string; severity: string; rationale: string; routeTo: string }>;
  pendingApprovals: number;
  escalationSurge: boolean;
  campaignDegradation: boolean;
  campaignDegradationDetail: string;
  workflowAtRisk: Array<{ id: string; title: string; detail: string }>;
  workflowPaused: Array<{ id: string; title: string; detail: string }>;
  operatorOverload: Array<{ label: string; detail: string }>;
};

export function buildExecutivePresenceInterruptions(input: InterruptionSourceInput): ExecutiveInterruption[] {
  const out: ExecutiveInterruption[] = [];

  if (input.topIncident) {
    out.push({
      id: `incident:${input.topIncident.title}`,
      kind: "incident",
      severity:
        input.topIncident.severity === "critical"
          ? "critical"
          : input.topIncident.severity === "high"
            ? "high"
            : "medium",
      title: input.topIncident.title,
      detail: input.topIncident.summary,
      routeHint: "Review incident intelligence on the command desk — human authorization required.",
      advisoryOnly: true,
      entityRefs: ["operators", "workflows"],
    });
  }

  if (input.pendingApprovals >= 1) {
    out.push({
      id: "approval:backlog",
      kind: "approval_backlog",
      severity: input.pendingApprovals >= 5 ? "high" : input.pendingApprovals >= 2 ? "medium" : "watch",
      title: `${input.pendingApprovals} approval(s) awaiting your decision`,
      detail: "Governed writes remain queued until you authorize — Skipper will not execute on your behalf.",
      routeHint: "Open the approval queue on the executive desk.",
      advisoryOnly: true,
      entityRefs: ["workflows"],
    });
  }

  if (input.escalationSurge) {
    out.push({
      id: "escalation:surge",
      kind: "escalation_warning",
      severity: "high",
      title: "Escalation surge on the desk",
      detail: "Multiple proposed escalations or overdue tasks need executive coordination — no auto-escalation.",
      routeHint: "Review escalation panel and operator workload.",
      advisoryOnly: true,
      entityRefs: ["operators", "Jarva", "Bentley"],
    });
  }

  if (input.campaignDegradation) {
    out.push({
      id: "launch:degradation",
      kind: "launch_degradation",
      severity: "medium",
      title: "Launch / campaign degradation watch",
      detail: input.campaignDegradationDetail || "REVENUE_OS friction signals — Bentley desk may need attention.",
      routeHint: "Coordinate with Bentley on campaign readiness — no autonomous publish.",
      advisoryOnly: true,
      entityRefs: ["Bentley", "workflows"],
    });
  }

  for (const w of input.workflowAtRisk.slice(0, 3)) {
    out.push({
      id: `workflow:risk:${w.id}`,
      kind: "workflow_risk",
      severity: "medium",
      title: w.title,
      detail: w.detail,
      routeHint: "Inspect workflow fabric continuity — pause/resume requires explicit authorization.",
      advisoryOnly: true,
      entityRefs: ["workflows"],
    });
  }

  for (const w of input.workflowPaused.slice(0, 2)) {
    out.push({
      id: `workflow:paused:${w.id}`,
      kind: "workflow_risk",
      severity: "watch",
      title: `Recovery: ${w.title}`,
      detail: w.detail,
      routeHint: "Workflow recovery mode — confirm resume when ready.",
      advisoryOnly: true,
      entityRefs: ["workflows"],
    });
  }

  for (const op of input.operatorOverload.slice(0, 2)) {
    out.push({
      id: `operator:${op.label}`,
      kind: "operator_overload",
      severity: "high",
      title: `${op.label} overloaded`,
      detail: op.detail,
      routeHint: "Review operator coordination — delegation requires approval.",
      advisoryOnly: true,
      entityRefs: ["operators"],
    });
  }

  for (const alert of input.topAlerts.slice(0, 4)) {
    if (out.some((i) => i.title === alert.title)) continue;
    out.push({
      id: `alert:${alert.title}`,
      kind: alert.title.toLowerCase().includes("escalation") ? "escalation_warning" : "workflow_risk",
      severity:
        alert.severity === "critical" ? "critical" : alert.severity === "high" ? "high" : "medium",
      title: alert.title,
      detail: alert.rationale,
      routeHint: alert.routeTo.replace(/_/g, " "),
      advisoryOnly: true,
      entityRefs: ["operators"],
    });
  }

  return out;
}
