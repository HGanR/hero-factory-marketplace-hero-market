import { buildExecutiveKpiOverviewFromEngine } from "@/lib/fulfillment/executive-kpi-engine";
import { prioritizeExecutiveAlerts } from "@/lib/executive-agent/executive-alert-prioritization";
import { routeCrossDepartmentCommand } from "@/lib/executive-agent/command-routing-engine";
import { coordinateOperationalCrisis } from "@/lib/executive-agent/crisis-coordination-engine";
import type {
  ExecutiveCommandEngineInput,
  ExecutiveCommandOverviewResult,
} from "@/lib/executive-agent/executive-command-types";
import { detectEscalationSurge } from "@/lib/executive-agent/escalation-surge-detection";
import { monitorCampaignDegradation } from "@/lib/executive-agent/campaign-degradation-monitor";
import { detectGovernanceAnomalies } from "@/lib/executive-agent/governance-anomaly-detection";
import { buildIncidentIntelligence } from "@/lib/executive-agent/incident-intelligence";
import { monitorKpiDrift } from "@/lib/executive-agent/kpi-drift-monitor";
import { aggregateOperationalEventStream } from "@/lib/executive-agent/operational-event-stream";

function calibrateCommandConfidence(input: ExecutiveCommandEngineInput): {
  confidence: ExecutiveCommandOverviewResult["confidence"];
  score: number;
} {
  const orders = input.kpi.snapshots.length;
  let score = 0.48;
  if (orders >= 8) score += 0.2;
  else if (orders >= 3) score += 0.1;
  if (input.auditActionTypes.length >= 10) score += 0.12;
  if (input.tasks.length >= 5) score += 0.1;
  score = Math.min(0.92, score);
  return {
    confidence: score >= 0.7 ? "high" : score >= 0.5 ? "medium" : "low",
    score: Math.round(score * 100) / 100,
  };
}

/** Full executive command center overview — monitoring and advisory only. */
export function buildExecutiveCommandOverview(
  input: ExecutiveCommandEngineInput
): ExecutiveCommandOverviewResult {
  const eventStream = aggregateOperationalEventStream(input);
  const incidents = buildIncidentIntelligence(input);
  const governanceAnomalies = detectGovernanceAnomalies(input);
  const kpiDrift = monitorKpiDrift(input);
  const campaignDegradation = monitorCampaignDegradation(input);
  const escalationSurge = detectEscalationSurge(input);
  const crisisCoordination = coordinateOperationalCrisis(input);
  const commandRouting = routeCrossDepartmentCommand(input);
  const alertPrioritization = prioritizeExecutiveAlerts(input);

  const kpiOverview = buildExecutiveKpiOverviewFromEngine(input.kpi);
  const cal = calibrateCommandConfidence(input);
  const criticalAlerts = alertPrioritization.alerts.filter(
    (a) => a.severity === "critical" || a.severity === "high"
  ).length;

  const skipperSummary = [
    "Executive command center (monitoring only — no autonomous execution):",
    `${eventStream.eventCount} live event(s), ${incidents.incidents.length} incident(s), ${alertPrioritization.alertCount} prioritized alert(s).`,
    `Crisis level: ${crisisCoordination.crisisLevel}; KPI drift score ${kpiDrift.driftScore}.`,
    incidents.topIncident
      ? `Top incident: ${incidents.topIncident.title} (${incidents.topIncident.severity}).`
      : "No critical incidents in window.",
    "All routing and escalation advisories require human approval.",
  ].join(" ");

  return {
    eventStream,
    incidents,
    governanceAnomalies,
    kpiDrift,
    campaignDegradation,
    escalationSurge,
    crisisCoordination,
    commandRouting,
    alertPrioritization,
    deskSnapshot: {
      activeOrders: kpiOverview.totals.activeOrders,
      stalledOrders: kpiOverview.totals.stalledOrders,
      pendingApprovals: kpiOverview.totals.pendingApprovals,
      criticalAlerts,
    },
    confidence: cal.confidence,
    confidenceScore: cal.score,
    skipperSummary,
    generatedAt: new Date().toISOString(),
    meta: {
      monitoringOnly: true,
      advisoryOnly: true,
      noAutonomousExecution: true,
      noProductionMutation: true,
      explainable: true,
      evidenceLinked: true,
      severityRanked: true,
    },
  };
}
