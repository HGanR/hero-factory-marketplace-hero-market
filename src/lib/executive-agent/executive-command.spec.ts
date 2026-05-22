import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildExecutiveCommandOverview } from "@/lib/executive-agent/executive-command-engine";
import { aggregateOperationalEventStream } from "@/lib/executive-agent/operational-event-stream";
import { buildIncidentIntelligence } from "@/lib/executive-agent/incident-intelligence";
import { detectGovernanceAnomalies } from "@/lib/executive-agent/governance-anomaly-detection";
import { monitorKpiDrift } from "@/lib/executive-agent/kpi-drift-monitor";
import { monitorCampaignDegradation } from "@/lib/executive-agent/campaign-degradation-monitor";
import { detectEscalationSurge } from "@/lib/executive-agent/escalation-surge-detection";
import { coordinateOperationalCrisis } from "@/lib/executive-agent/crisis-coordination-engine";
import { routeCrossDepartmentCommand } from "@/lib/executive-agent/command-routing-engine";
import { prioritizeExecutiveAlerts } from "@/lib/executive-agent/executive-alert-prioritization";
import { pickExecutiveReadTools } from "@/lib/executive-agent/executive-agent-read-tool-picker";
import type { ExecutiveCommandEngineInput } from "@/lib/executive-agent/executive-command-types";
import type { ClientFulfillmentOrderSnapshot } from "@/lib/fulfillment/fulfillment-orchestration-types";

function snap(partial: Partial<ClientFulfillmentOrderSnapshot> & { orderId: string }): ClientFulfillmentOrderSnapshot {
  return {
    clientId: "c1",
    department: "WEBSITE",
    assignedDepartment: "site_builder",
    pipelineStage: "service_drafting",
    approvalStatus: "none",
    ownerReviewStatus: null,
    paymentStatus: "confirmed",
    paymentConsumed: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    daysInCurrentStage: 5,
    ...partial,
  };
}

const baseInput: ExecutiveCommandEngineInput = {
  kpi: {
    snapshots: [
      snap({ orderId: "o1", approvalStatus: "pending", daysInCurrentStage: 11 }),
      snap({ orderId: "o2", department: "SMART_TRUST", daysInCurrentStage: 9, trustId: null }),
      snap({ orderId: "o3", department: "REVENUE_OS", daysInCurrentStage: 12, approvalStatus: "pending" }),
      snap({ orderId: "o4", daysInCurrentStage: 14 }),
    ],
    bottlenecks: [{ id: "b1", department: "WEBSITE", stage: "service_drafting", orderCount: 2, summary: "stuck" }],
    approvalLatency: [],
    clientLifecycle: [],
    outcomes: [],
    healthByClient: [{ clientId: "c1", tier: "at_risk", score: 45, stalled: true }],
  },
  operatorWorkload: [
    {
      operatorId: "website_desk_lead",
      label: "WEBSITE desk",
      department: "WEBSITE",
      openTasks: 6,
      inProgressTasks: 1,
      blockedTasks: 0,
      overdueTasks: 2,
      delegatedPendingAcceptance: 0,
      loadIndex: 82,
      balanceLabel: "overloaded",
    },
  ],
  tasks: [],
  metadataByTaskId: new Map(),
  auditActionTypes: ["read_tool", "simulation_run", "planning_generated"],
  auditToolNames: ["getExecutiveCommandOverview"],
};

describe("executive command engine", () => {
  it("aggregates operational event stream", () => {
    const stream = aggregateOperationalEventStream(baseInput);
    assert.ok(stream.eventCount >= 3);
    assert.equal(stream.advisoryOnly, true);
  });

  it("builds incident intelligence", () => {
    const inc = buildIncidentIntelligence(baseInput);
    assert.ok(inc.incidents.length >= 1);
    assert.equal(inc.advisoryOnly, true);
  });

  it("detects governance anomalies", () => {
    const gov = detectGovernanceAnomalies(baseInput);
    assert.ok(gov.anomalyCount >= 1);
  });

  it("monitors KPI drift", () => {
    const drift = monitorKpiDrift(baseInput);
    assert.ok(drift.driftSignals.length >= 1);
  });

  it("monitors campaign degradation", () => {
    const camp = monitorCampaignDegradation(baseInput);
    assert.ok(camp.atRiskOrders >= 1);
  });

  it("detects escalation surge baseline", () => {
    const esc = detectEscalationSurge(baseInput);
    assert.equal(esc.advisoryOnly, true);
  });

  it("coordinates crisis advisory steps", () => {
    const crisis = coordinateOperationalCrisis(baseInput);
    assert.ok(crisis.coordinationSteps.length >= 1);
  });

  it("routes cross-department command advisories", () => {
    const routes = routeCrossDepartmentCommand(baseInput);
    assert.ok(routes.routes.length >= 1);
  });

  it("prioritizes executive alerts", () => {
    const alerts = prioritizeExecutiveAlerts(baseInput);
    assert.ok(alerts.alertCount >= 1);
    assert.ok(alerts.alerts.every((a) => a.advisoryOnly));
  });

  it("assembles full command overview", () => {
    const overview = buildExecutiveCommandOverview(baseInput);
    assert.ok(overview.skipperSummary.includes("monitoring"));
    assert.equal(overview.meta.noAutonomousExecution, true);
    assert.equal(overview.meta.severityRanked, true);
    assert.ok(overview.deskSnapshot.criticalAlerts >= 0);
  });
});

describe("Skipper read tools", () => {
  it("picker selects command center tools", () => {
    const tools = pickExecutiveReadTools(
      "Show the executive command center and priority incidents with KPI drift",
      null,
      null
    );
    assert.ok(tools.includes("getExecutiveCommandOverview"));
    assert.ok(tools.includes("getExecutiveCommandIncidents"));
    assert.ok(tools.includes("getExecutiveCommandAlerts"));
  });
});
