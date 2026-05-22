import type {
  AlertPrioritizationResult,
  CommandIncident,
  ExecutiveAlert,
  ExecutiveCommandEngineInput,
} from "@/lib/executive-agent/executive-command-types";
import { buildIncidentIntelligence } from "@/lib/executive-agent/incident-intelligence";
import { detectGovernanceAnomalies } from "@/lib/executive-agent/governance-anomaly-detection";
import { monitorKpiDrift } from "@/lib/executive-agent/kpi-drift-monitor";
import { monitorCampaignDegradation } from "@/lib/executive-agent/campaign-degradation-monitor";
import { detectEscalationSurge } from "@/lib/executive-agent/escalation-surge-detection";

const SEV_RANK = { critical: 5, high: 4, medium: 3, low: 2, watch: 1 };

function alertFromIncident(inc: CommandIncident, rank: number): ExecutiveAlert {
  const routeTo =
    inc.department === "WEBSITE"
      ? "website_desk_lead"
      : inc.department === "TRUST"
        ? "trust_desk_lead"
        : inc.department === "REVENUE_OS"
          ? "revenue_os_desk_lead"
          : inc.department === "SMART_TRUST"
            ? "smart_trust_desk_lead"
            : inc.category === "cross_department_crisis"
              ? "executive_owner"
              : "department_lead";

  return {
    id: `alert:${inc.id}`,
    rank,
    title: inc.title,
    severity: inc.severity,
    department: inc.department,
    routeTo,
    rationale: inc.summary,
    confidence: inc.confidence,
    evidence: inc.evidence,
    advisoryOnly: true,
  };
}

export function prioritizeExecutiveAlerts(
  input: ExecutiveCommandEngineInput
): AlertPrioritizationResult {
  const incidents = buildIncidentIntelligence(input);
  const governance = detectGovernanceAnomalies(input);
  const kpiDrift = monitorKpiDrift(input);
  const campaign = monitorCampaignDegradation(input);
  const escalation = detectEscalationSurge(input);

  const alerts: ExecutiveAlert[] = incidents.incidents.map((inc, i) =>
    alertFromIncident(inc, i + 1)
  );

  if (kpiDrift.driftScore >= 0.4) {
    alerts.push({
      id: "alert:kpi_drift",
      rank: alerts.length + 1,
      title: "KPI drift detected",
      severity: kpiDrift.driftScore >= 0.6 ? "high" : "medium",
      department: null,
      routeTo: "executive_owner",
      rationale: kpiDrift.driftSignals.map((d) => d.detail).join("; "),
      confidence: kpiDrift.confidence,
      evidence: kpiDrift.evidence,
      advisoryOnly: true,
    });
  }

  if (campaign.atRiskOrders >= 1) {
    alerts.push({
      id: "alert:campaign_degradation",
      rank: alerts.length + 1,
      title: "Campaign degradation watch",
      severity: campaign.atRiskOrders >= 2 ? "high" : "medium",
      department: "REVENUE_OS",
      routeTo: "revenue_os_desk_lead",
      rationale: campaign.degradationSignals.join("; ") || "REVENUE_OS friction",
      confidence: campaign.confidence,
      evidence: campaign.evidence,
      advisoryOnly: true,
    });
  }

  if (escalation.surgeDetected) {
    alerts.push({
      id: "alert:escalation_surge",
      rank: alerts.length + 1,
      title: "Escalation surge",
      severity: escalation.severity,
      department: null,
      routeTo: "executive_owner",
      rationale: `${escalation.proposedEscalations} escalation(s), ${escalation.overdueTasks} overdue — no auto-escalate`,
      confidence: "medium",
      evidence: escalation.evidence,
      advisoryOnly: true,
    });
  }

  for (const g of governance.anomalies.slice(0, 3)) {
    alerts.push({
      id: `alert:${g.id}`,
      rank: alerts.length + 1,
      title: "Governance anomaly",
      severity: g.severity,
      department: g.department,
      routeTo: "smart_trust_desk_lead",
      rationale: g.summary,
      confidence: governance.confidence,
      evidence: governance.evidence,
      advisoryOnly: true,
    });
  }

  alerts.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]);
  alerts.forEach((a, i) => {
    a.rank = i + 1;
  });

  return {
    alerts: alerts.slice(0, 20),
    alertCount: alerts.length,
    evidence: [{ source: "inference", detail: `${alerts.length} alert(s) prioritized` }],
    advisoryOnly: true,
  };
}
