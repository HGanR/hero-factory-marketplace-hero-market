import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PLANNING_PLANS,
  runExecutivePlanning,
} from "@/lib/executive-agent/executive-planning-engine";
import { buildOperationalRecoveryPlan } from "@/lib/executive-agent/operational-recovery-planning";
import { buildStaffingAdjustmentPlan } from "@/lib/executive-agent/staffing-adjustment-planning";
import { buildBottleneckMitigationPlan } from "@/lib/executive-agent/bottleneck-mitigation-planning";
import { buildCampaignSequencingPlan } from "@/lib/executive-agent/campaign-sequencing-planning";
import { buildGovernanceSchedulingPlan } from "@/lib/executive-agent/governance-scheduling-planning";
import { buildEscalationResponsePlan } from "@/lib/executive-agent/escalation-response-planning";
import { buildWorkloadBalancePlan } from "@/lib/executive-agent/workload-balance-planning";
import { buildExecutiveInitiativePlan } from "@/lib/executive-agent/executive-initiative-planning";
import { buildPlanningScenarioContext } from "@/lib/executive-agent/planning-scenario-builder";
import { pickExecutiveReadTools } from "@/lib/executive-agent/executive-agent-read-tool-picker";
import type { ExecutivePlanningEngineInput } from "@/lib/executive-agent/executive-planning-types";
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

const baseInput: ExecutivePlanningEngineInput = {
  kpi: {
    snapshots: [
      snap({ orderId: "o1", daysInCurrentStage: 12 }),
      snap({ orderId: "o2", department: "SMART_TRUST", approvalStatus: "pending", daysInCurrentStage: 9 }),
      snap({ orderId: "o3", department: "REVENUE_OS", daysInCurrentStage: 6 }),
    ],
    bottlenecks: [{ id: "b1", department: "WEBSITE", stage: "service_drafting", orderCount: 2, summary: "stuck" }],
    approvalLatency: [],
    clientLifecycle: [],
    outcomes: [],
    healthByClient: [],
  },
  operatorWorkload: [
    {
      operatorId: "website_desk_lead",
      label: "WEBSITE desk",
      department: "WEBSITE",
      openTasks: 5,
      inProgressTasks: 1,
      blockedTasks: 0,
      overdueTasks: 1,
      delegatedPendingAcceptance: 0,
      loadIndex: 78,
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
      loadIndex: 12,
      balanceLabel: "underloaded",
    },
  ],
  tasks: [],
  metadataByTaskId: new Map(),
  strategicPriorityTitles: ["Q2 growth initiative"],
  openDecisionCount: 2,
};

describe("executive planning engine", () => {
  it("exposes planning catalog", () => {
    assert.ok(PLANNING_PLANS.length >= 8);
  });

  it("builds planning scenario context", () => {
    const ctx = buildPlanningScenarioContext(baseInput, "operational_recovery", 14);
    assert.ok(ctx.stalledOrders >= 1);
    assert.ok(ctx.evidence.length > 0);
  });

  it("builds operational recovery plan", () => {
    const plan = buildOperationalRecoveryPlan(baseInput, 14);
    assert.equal(plan.advisoryOnly, true);
    assert.equal(plan.noAutonomousExecution, true);
    assert.ok(plan.steps.length >= 1);
    assert.ok(plan.steps.every((s) => s.reversible && s.requiresHumanApproval));
  });

  it("builds staffing adjustment plan", () => {
    const plan = buildStaffingAdjustmentPlan(baseInput, 14);
    assert.ok(plan.summary.includes("delegation") || plan.summary.includes("reassign"));
  });

  it("builds bottleneck mitigation plan", () => {
    const plan = buildBottleneckMitigationPlan(baseInput, 14);
    assert.ok(plan.steps.length >= 1);
  });

  it("builds campaign sequencing plan", () => {
    const plan = buildCampaignSequencingPlan(baseInput, 14);
    assert.equal(plan.planId, "campaign_sequencing");
  });

  it("builds governance scheduling plan", () => {
    const plan = buildGovernanceSchedulingPlan(baseInput, 14);
    assert.equal(plan.planId, "governance_scheduling");
  });

  it("builds escalation response plan", () => {
    const plan = buildEscalationResponsePlan(baseInput, 14);
    assert.equal(plan.advisoryOnly, true);
  });

  it("builds workload balance plan", () => {
    const plan = buildWorkloadBalancePlan(baseInput, 14);
    assert.ok(plan.steps.length >= 1);
  });

  it("builds executive initiative plan", () => {
    const plan = buildExecutiveInitiativePlan(baseInput, 21);
    assert.ok(plan.steps.some((s) => s.action.includes("initiative")));
  });

  it("runs full planning bundle", () => {
    const result = runExecutivePlanning(baseInput, "multi_department_ops", 14);
    assert.ok(result.skipperSummary.includes("advisory"));
    assert.equal(result.meta.planningOnly, true);
    assert.equal(result.meta.noAutonomousExecution, true);
    assert.equal(result.meta.reversible, true);
    assert.ok(result.multiDepartment.steps.length >= 3);
  });
});

describe("Skipper read tools", () => {
  it("picker selects planning tools", () => {
    const tools = pickExecutiveReadTools("Generate an executive operational recovery plan", null, null);
    assert.ok(tools.includes("getExecutivePlanningOverview"));
    assert.ok(tools.includes("generateExecutivePlan"));
  });
});
