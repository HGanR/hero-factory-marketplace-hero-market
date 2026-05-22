import type {
  CommandIncident,
  ExecutiveCommandEngineInput,
  IncidentIntelligenceResult,
} from "@/lib/executive-agent/executive-command-types";
import { aggregateOperationalEventStream } from "@/lib/executive-agent/operational-event-stream";

function incident(
  partial: Omit<CommandIncident, "advisoryOnly">
): CommandIncident {
  return { ...partial, advisoryOnly: true };
}

export function buildIncidentIntelligence(
  input: ExecutiveCommandEngineInput
): IncidentIntelligenceResult {
  const stream = aggregateOperationalEventStream(input);
  const incidents: CommandIncident[] = [];

  const stalled = stream.events.filter((e) => e.kind === "order_stalled");
  if (stalled.length >= 2) {
    incidents.push(
      incident({
        id: "inc:stall_spike",
        title: "Stalled fulfillment spike",
        severity: stalled.some((e) => e.severity === "critical") ? "critical" : "high",
        department: null,
        category: "fulfillment_stall",
        confidence: stalled.length >= 4 ? "high" : "medium",
        confidenceScore: Math.min(0.9, 0.5 + stalled.length * 0.08),
        summary: `${stalled.length} stalled order signal(s) — advisory triage only; no autonomous stage changes.`,
        evidence: stalled.slice(0, 3).flatMap((e) => e.evidence),
      })
    );
  }

  const approvals = stream.events.filter((e) => e.kind === "approval_pending");
  if (approvals.length >= 3) {
    incidents.push(
      incident({
        id: "inc:approval_surge",
        title: "Approval surge",
        severity: "high",
        department: null,
        category: "approval_surge",
        confidence: "high",
        confidenceScore: 0.8,
        summary: `${approvals.length} pending approval event(s) — owner review required; no auto-approve.`,
        evidence: [{ source: "snapshots", detail: `${approvals.length} pending gates` }],
      })
    );
  }

  const escalations = stream.events.filter((e) => e.kind === "escalation_proposed");
  if (escalations.length >= 2) {
    incidents.push(
      incident({
        id: "inc:escalation_surge",
        title: "Escalation surge",
        severity: "high",
        department: null,
        category: "escalation_surge",
        confidence: "medium",
        confidenceScore: 0.72,
        summary: `${escalations.length} proposed escalation(s) — human approval required; no autonomous escalation.`,
        evidence: [{ source: "tasks", detail: "Escalation metadata on tasks" }],
      })
    );
  }

  const overload = stream.events.filter((e) => e.kind === "operator_overload");
  if (overload.length >= 1) {
    incidents.push(
      incident({
        id: "inc:operator_overload",
        title: "Operator overload",
        severity: "high",
        department: overload[0]?.department ?? null,
        category: "operator_overload",
        confidence: "high",
        confidenceScore: 0.85,
        summary: `${overload.length} overloaded operator signal(s) — staffing advisory only.`,
        evidence: overload.flatMap((e) => e.evidence),
      })
    );
  }

  const gov = stream.events.filter((e) => e.kind === "governance_delay");
  if (gov.length >= 1) {
    incidents.push(
      incident({
        id: "inc:governance_anomaly",
        title: "Governance anomaly cluster",
        severity: "high",
        department: "SMART_TRUST",
        category: "governance_anomaly",
        confidence: "medium",
        confidenceScore: 0.68,
        summary: `${gov.length} SMART_TRUST governance delay signal(s).`,
        evidence: gov.flatMap((e) => e.evidence),
      })
    );
  }

  const depts = new Set(
    incidents.filter((i) => i.severity === "critical" || i.severity === "high").map((i) => i.department)
  );
  if (incidents.filter((i) => i.severity === "high" || i.severity === "critical").length >= 3 && depts.size >= 2) {
    incidents.push(
      incident({
        id: "inc:cross_dept_crisis",
        title: "Cross-department operational crisis watch",
        severity: "critical",
        department: null,
        category: "cross_department_crisis",
        confidence: "medium",
        confidenceScore: 0.75,
        summary: "Multiple high-severity incidents across departments — executive command review advised.",
        evidence: [{ source: "inference", detail: `${depts.size} departments affected` }],
      })
    );
  }

  const rank = { critical: 4, high: 3, medium: 2, low: 1, watch: 0 };
  incidents.sort((a, b) => rank[b.severity] - rank[a.severity]);

  return {
    incidents,
    topIncident: incidents[0] ?? null,
    evidence: [{ source: "inference", detail: `${incidents.length} incident(s) classified` }],
    advisoryOnly: true,
  };
}
