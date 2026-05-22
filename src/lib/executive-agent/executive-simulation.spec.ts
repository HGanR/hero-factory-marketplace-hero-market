import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calibrateForecastConfidence,
  runExecutiveSimulation,
  SIMULATION_SCENARIOS,
} from "@/lib/executive-agent/executive-simulation-engine";
import { simulateFulfillmentTimeline } from "@/lib/executive-agent/fulfillment-timeline-simulation";
import { simulateApprovalDelayImpact } from "@/lib/executive-agent/approval-delay-impact";
import { modelCampaignLaunchProbability } from "@/lib/executive-agent/campaign-launch-probability";
import { simulateBottleneckCascade } from "@/lib/executive-agent/bottleneck-cascade-simulation";
import { compareSimulationScenarios } from "@/lib/executive-agent/scenario-comparison-engine";
import { pickExecutiveReadTools } from "@/lib/executive-agent/executive-agent-read-tool-picker";
import type { ExecutiveSimulationEngineInput } from "@/lib/executive-agent/executive-simulation-types";
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

const baseInput: ExecutiveSimulationEngineInput = {
  kpi: {
    snapshots: [
      snap({ orderId: "o1", approvalStatus: "pending", daysInCurrentStage: 8 }),
      snap({ orderId: "o2", department: "REVENUE_OS", campaignId: "camp-1", daysInCurrentStage: 10 }),
      snap({ orderId: "o3", department: "SMART_TRUST", trustId: null, daysInCurrentStage: 9 }),
    ],
    bottlenecks: [{ id: "b1", department: "WEBSITE", stage: "service_drafting", orderCount: 2, summary: "stuck" }],
    approvalLatency: [{ proposedAction: "createSiteBuilderTask", department: "WEBSITE", sampleCount: 3, medianHoursToExecute: 60, fastestHours: 12, slowestHours: 90 }],
    clientLifecycle: [{ clientId: "c1", guidanceScore: 50, revisionBurden: "high", departmentsActive: ["WEBSITE"], insight: "heavy" }],
    outcomes: [],
    healthByClient: [{ clientId: "c1", tier: "at_risk", score: 45, stalled: true }],
  },
  operatorWorkload: [
    {
      operatorId: "website_desk_lead",
      label: "WEBSITE desk",
      department: "WEBSITE",
      openTasks: 4,
      inProgressTasks: 1,
      blockedTasks: 1,
      overdueTasks: 1,
      delegatedPendingAcceptance: 0,
      loadIndex: 75,
      balanceLabel: "overloaded",
    },
    {
      operatorId: "fulfillment_coordinator",
      label: "Coordinator",
      department: null,
      openTasks: 1,
      inProgressTasks: 0,
      blockedTasks: 0,
      overdueTasks: 0,
      delegatedPendingAcceptance: 0,
      loadIndex: 15,
      balanceLabel: "underloaded",
    },
  ],
  tasks: [],
  metadataByTaskId: new Map(),
};

describe("executive simulation engine", () => {
  it("exposes scenario catalog", () => {
    assert.ok(SIMULATION_SCENARIOS.length >= 5);
  });

  it("simulates fulfillment timeline with evidence", () => {
    const t = simulateFulfillmentTimeline(baseInput, { horizonDays: 14, approvalDelayHours: 24 });
    assert.ok(t.medianCompletionDays >= 0);
    assert.equal(t.advisoryOnly, true);
    assert.ok(t.evidence.length > 0);
  });

  it("models approval delay impact", () => {
    const impact = simulateApprovalDelayImpact(baseInput, 48);
    assert.equal(impact.pendingApprovals, 1);
    assert.ok(impact.projectedDeskDelayDays >= 2);
  });

  it("models campaign launch probability", () => {
    const launch = modelCampaignLaunchProbability(baseInput);
    assert.ok(launch.launchSuccessProbability >= 0 && launch.launchSuccessProbability <= 1);
  });

  it("runs full scenario with comparison to baseline", () => {
    const baseline = runExecutiveSimulation(baseInput, "baseline");
    const stress = runExecutiveSimulation(baseInput, "approval_delay_stress", { additionalApprovalDelayHours: 48 }, baseline);
    assert.ok(stress.scenarioComparison.length > 0);
    assert.ok(stress.skipperSummary.includes("advisory"));
  });

  it("calibrates confidence from samples", () => {
    const cal = calibrateForecastConfidence(baseInput);
    assert.ok(cal.overallScore > 0);
    assert.ok(cal.calibrationNotes.length > 0);
  });

  it("simulates bottleneck cascade", () => {
    const c = simulateBottleneckCascade(baseInput);
    assert.ok(c.projectedCascadeDepth >= 1);
    assert.equal(c.advisoryOnly, true);
  });

  it("compares scenarios", () => {
    const baseline = runExecutiveSimulation(baseInput, "baseline");
    const stress = runExecutiveSimulation(baseInput, "approval_delay_stress", { additionalApprovalDelayHours: 48 });
    const rows = compareSimulationScenarios(baseline, stress);
    assert.ok(rows.some((r) => r.metric.includes("Approval")));
  });
});

describe("Skipper read tools", () => {
  it("picker selects simulation tools", () => {
    const tools = pickExecutiveReadTools("Run a what-if simulation on approval delay impact", null, null);
    assert.ok(tools.includes("getExecutiveSimulationOverview"));
    assert.ok(tools.includes("runExecutiveSimulation"));
  });
});
