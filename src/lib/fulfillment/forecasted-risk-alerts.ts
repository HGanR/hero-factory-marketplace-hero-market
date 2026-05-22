import { randomUUID } from "crypto";
import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
} from "@/lib/fulfillment/fulfillment-types";
import type {
  ApprovalDelayForecast,
  BottleneckForecast,
  ExecutiveKpiEngineInput,
  ForecastedRiskAlert,
  FulfillmentDelayForecast,
  RevisionRiskForecast,
} from "@/lib/fulfillment/executive-kpi-forecast-types";
import type { DepartmentWorkloadSnapshot } from "@/lib/fulfillment/executive-kpi-forecast-types";

function confidenceScore(c: ForecastedRiskAlert["confidence"]): number {
  return c === "high" ? 0.85 : c === "medium" ? 0.6 : 0.35;
}

export function buildForecastedRiskAlerts(input: {
  engine: ExecutiveKpiEngineInput;
  fulfillmentDelays: FulfillmentDelayForecast[];
  bottleneckForecasts: BottleneckForecast[];
  revisionRisks: RevisionRiskForecast[];
  approvalDelays: ApprovalDelayForecast[];
  departmentWorkload: DepartmentWorkloadSnapshot[];
}): ForecastedRiskAlert[] {
  const alerts: ForecastedRiskAlert[] = [];

  for (const d of input.fulfillmentDelays.slice(0, 8)) {
    if (d.projectedDelayDays < 5) continue;
    alerts.push({
      id: randomUUID(),
      severity: d.projectedDelayDays >= 10 ? "high" : "medium",
      category: "fulfillment_delay",
      department: d.department,
      title: `Projected ${d.projectedDelayDays}d delay — ${d.department}`,
      rationale: d.rationale,
      confidence: d.confidence,
      confidenceScore: confidenceScore(d.confidence) * (d.stallLikelihood / 100),
      relatedOrderIds: [d.orderId],
      relatedClientIds: [d.clientId],
      memoryEvidence: null,
      advisoryOnly: true,
    });
  }

  for (const b of input.bottleneckForecasts.filter((f) => f.daysToEscalation != null && f.daysToEscalation <= 7)) {
    alerts.push({
      id: randomUUID(),
      severity: "medium",
      category: "workflow_stall",
      department: b.bottleneck.department,
      title: `Bottleneck may escalate in ~${b.daysToEscalation}d`,
      rationale: b.rationale,
      confidence: b.confidence,
      confidenceScore: confidenceScore(b.confidence),
      relatedOrderIds: [],
      relatedClientIds: [],
      memoryEvidence: null,
      advisoryOnly: true,
    });
  }

  for (const w of input.departmentWorkload.filter(
    (d) => d.balanceLabel === "overloaded" || d.balanceLabel === "elevated"
  )) {
    alerts.push({
      id: randomUUID(),
      severity: w.balanceLabel === "overloaded" ? "high" : "medium",
      category: "department_overload",
      department: w.department,
      title: `${w.department} workload ${w.balanceLabel}`,
      rationale: `Load index ${w.loadIndex}: ${w.activeOrders} active, ${w.stalledOrders} stalled, ${w.pendingApprovals} pending approvals.`,
      confidence: w.stalledOrders >= 2 ? "high" : "medium",
      confidenceScore: w.loadIndex / 100,
      relatedOrderIds: [],
      relatedClientIds: [],
      memoryEvidence: null,
      advisoryOnly: true,
    });
  }

  for (const r of input.revisionRisks.slice(0, 6)) {
    alerts.push({
      id: randomUUID(),
      severity: r.revisionBurden === "high" ? "high" : "medium",
      category: "revision_risk",
      department: null,
      title: `Revision risk — client ${r.clientId.slice(0, 8)}…`,
      rationale: r.rationale,
      confidence: r.confidence,
      confidenceScore: confidenceScore(r.confidence),
      relatedOrderIds: r.orderIds,
      relatedClientIds: [r.clientId],
      memoryEvidence: r.memoryEvidence,
      advisoryOnly: true,
    });
  }

  for (const a of input.approvalDelays.filter((x) => x.pendingCount > 0).slice(0, 6)) {
    alerts.push({
      id: randomUUID(),
      severity: a.pendingCount >= 3 ? "high" : "medium",
      category: "approval_bottleneck",
      department: a.department,
      title: `Approval delay forecast — ${a.pendingCount} pending`,
      rationale: a.rationale,
      confidence: a.confidence,
      confidenceScore: confidenceScore(a.confidence),
      relatedOrderIds: [],
      relatedClientIds: [],
      memoryEvidence: null,
      advisoryOnly: true,
    });
  }

  const campaignStalled = input.engine.outcomes.filter(
    (o) =>
      o.department === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS &&
      (o.outcome === "revenue_os_campaign_stalled" || o.outcome === "revenue_os_kpi_watch")
  );
  for (const o of campaignStalled.slice(0, 4)) {
    alerts.push({
      id: randomUUID(),
      severity: o.outcome === "revenue_os_campaign_stalled" ? "high" : "medium",
      category: "campaign_degradation",
      department: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
      title: `Campaign degradation signal — ${o.outcome}`,
      rationale: o.summary,
      confidence: "medium",
      confidenceScore: 0.55,
      relatedOrderIds: [o.orderId],
      relatedClientIds: [o.clientId],
      memoryEvidence: "Operational memory outcome tracker",
      advisoryOnly: true,
    });
  }

  const smartTrustRisk = input.engine.outcomes.filter(
    (o) =>
      o.department === FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST &&
      (o.outcome === "smart_trust_governance_blocked" ||
        o.outcome === "smart_trust_governance_stalled" ||
        o.outcome === "smart_trust_compliance_watch")
  );
  for (const o of smartTrustRisk.slice(0, 4)) {
    alerts.push({
      id: randomUUID(),
      severity: o.outcome.includes("blocked") ? "high" : "medium",
      category: "smart_trust_governance",
      department: FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
      title: `Smart Trust governance trend — ${o.outcome}`,
      rationale: o.summary,
      confidence: "medium",
      confidenceScore: 0.58,
      relatedOrderIds: [o.orderId],
      relatedClientIds: [o.clientId],
      memoryEvidence: "Governance workflow stagnation from operational memory",
      advisoryOnly: true,
    });
  }

  const stalledCount = input.engine.snapshots.filter(
    (s) =>
      s.pipelineStage !== "released" &&
      s.pipelineStage !== "closed" &&
      s.daysInCurrentStage >= 7
  ).length;
  if (stalledCount >= 3) {
    alerts.push({
      id: randomUUID(),
      severity: "high",
      category: "backlog_growth",
      department: null,
      title: "Projected operational backlog growth",
      rationale: `${stalledCount} orders already stalled — forecast projects continued desk backlog without owner intervention.`,
      confidence: stalledCount >= 5 ? "high" : "medium",
      confidenceScore: Math.min(0.9, stalledCount / 10),
      relatedOrderIds: [],
      relatedClientIds: [],
      memoryEvidence: `${stalledCount} stalled orders in snapshot`,
      advisoryOnly: true,
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 20);
}
