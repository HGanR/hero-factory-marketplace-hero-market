import { buildExecutiveKpiOverviewFromEngine } from "@/lib/fulfillment/executive-kpi-engine";
import { buildBottleneckMitigationPlan } from "@/lib/executive-agent/bottleneck-mitigation-planning";
import { buildCampaignSequencingPlan } from "@/lib/executive-agent/campaign-sequencing-planning";
import { buildEscalationResponsePlan } from "@/lib/executive-agent/escalation-response-planning";
import { buildExecutiveInitiativePlan } from "@/lib/executive-agent/executive-initiative-planning";
import type {
  ExecutivePlanningEngineInput,
  ExecutivePlanningRunResult,
  PlanningPlanDefinition,
  PlanningPlanId,
  PlanningModuleResult,
} from "@/lib/executive-agent/executive-planning-types";
import { buildGovernanceSchedulingPlan } from "@/lib/executive-agent/governance-scheduling-planning";
import { buildOperationalRecoveryPlan } from "@/lib/executive-agent/operational-recovery-planning";
import { buildPlanningScenarioContext } from "@/lib/executive-agent/planning-scenario-builder";
import { buildStaffingAdjustmentPlan } from "@/lib/executive-agent/staffing-adjustment-planning";
import { buildWorkloadBalancePlan } from "@/lib/executive-agent/workload-balance-planning";

export const PLANNING_PLANS: PlanningPlanDefinition[] = [
  {
    id: "multi_department_ops",
    label: "Multi-department operations",
    description: "Coordinated plan across WEBSITE, TRUST, REVENUE_OS, and SMART_TRUST desks.",
    departments: "all",
  },
  {
    id: "operational_recovery",
    label: "Fulfillment recovery",
    description: "Recover stalled orders, approvals, and blocked tasks.",
    departments: "all",
  },
  {
    id: "staffing_adjustment",
    label: "Staffing adjustment",
    description: "Advisory load redistribution — owner-approved delegation only.",
    departments: "all",
  },
  {
    id: "bottleneck_mitigation",
    label: "Bottleneck mitigation",
    description: "Mitigate recurring stage bottlenecks by department.",
    departments: "all",
  },
  {
    id: "campaign_sequencing",
    label: "Campaign sequencing",
    description: "REVENUE_OS launch sequencing without autonomous publish/spend.",
    departments: ["REVENUE_OS"],
  },
  {
    id: "governance_scheduling",
    label: "Trust governance scheduling",
    description: "SMART_TRUST governance cadence and review checkpoints.",
    departments: ["SMART_TRUST"],
  },
  {
    id: "escalation_response",
    label: "Escalation response",
    description: "Overdue task and escalation chain response plan.",
    departments: "all",
  },
  {
    id: "workload_balance",
    label: "Workload balance",
    description: "Strategic cross-desk workload balancing.",
    departments: "all",
  },
  {
    id: "executive_initiative",
    label: "Executive initiative",
    description: "Long-horizon initiative roadmap from strategic memory.",
    departments: "all",
  },
];

function buildMultiDepartmentOpsPlan(
  input: ExecutivePlanningEngineInput,
  horizonDays: number,
  modules: {
    recovery: PlanningModuleResult;
    staffing: PlanningModuleResult;
    bottleneck: PlanningModuleResult;
    campaign: PlanningModuleResult;
    governance: PlanningModuleResult;
  }
): PlanningModuleResult {
  const ctx = buildPlanningScenarioContext(input, "multi_department_ops", horizonDays);
  const steps = [
    ...modules.recovery.steps.slice(0, 2),
    ...modules.staffing.steps.slice(0, 1),
    ...modules.bottleneck.steps.slice(0, 2),
    ...modules.campaign.steps.slice(0, 1),
    ...modules.governance.steps.slice(0, 1),
  ].map((s, i) => ({ ...s, order: i + 1 }));

  return {
    planId: "multi_department_ops",
    title: "Multi-department operational plan",
    summary: `Unified ${horizonDays}-day desk plan across governed departments — all steps require human approval.`,
    steps,
    confidence: ctx.focusDepartments.length >= 2 ? "high" : "medium",
    confidenceScore: 0.8,
    evidence: ctx.evidence,
    advisoryOnly: true,
    planningOnly: true,
    noAutonomousExecution: true,
  };
}

function calibratePlanningConfidence(input: ExecutivePlanningEngineInput): {
  confidence: ExecutivePlanningRunResult["confidence"];
  score: number;
  evidence: ExecutivePlanningRunResult["evidence"];
} {
  const orders = input.kpi.snapshots.length;
  let score = 0.5;
  if (orders >= 8) score += 0.2;
  else if (orders >= 3) score += 0.1;
  if (input.tasks.length >= 5) score += 0.1;
  if (input.strategicPriorityTitles.length >= 1) score += 0.08;
  score = Math.min(0.9, score);
  const confidence = score >= 0.7 ? "high" : score >= 0.5 ? "medium" : "low";
  return {
    confidence,
    score: Math.round(score * 100) / 100,
    evidence: [
      { source: "snapshots", detail: `${orders} order snapshot(s)` },
      { source: "tasks", detail: `${input.tasks.length} operational task(s)` },
    ],
  };
}

export function runExecutivePlanning(
  input: ExecutivePlanningEngineInput,
  planId: PlanningPlanId = "multi_department_ops",
  horizonDays = 14
): ExecutivePlanningRunResult {
  const horizon = Math.min(Math.max(horizonDays, 7), 90);

  const operationalRecovery = buildOperationalRecoveryPlan(input, horizon);
  const staffingAdjustment = buildStaffingAdjustmentPlan(input, horizon);
  const bottleneckMitigation = buildBottleneckMitigationPlan(input, horizon);
  const campaignSequencing = buildCampaignSequencingPlan(input, horizon);
  const governanceScheduling = buildGovernanceSchedulingPlan(input, horizon);
  const escalationResponse = buildEscalationResponsePlan(input, horizon);
  const workloadBalance = buildWorkloadBalancePlan(input, horizon);
  const executiveInitiative = buildExecutiveInitiativePlan(input, horizon);

  const multiDepartment = buildMultiDepartmentOpsPlan(input, horizon, {
    recovery: operationalRecovery,
    staffing: staffingAdjustment,
    bottleneck: bottleneckMitigation,
    campaign: campaignSequencing,
    governance: governanceScheduling,
  });

  const cal = calibratePlanningConfidence(input);
  const overview = buildExecutiveKpiOverviewFromEngine(input.kpi);

  const primary =
    planId === "operational_recovery"
      ? operationalRecovery
      : planId === "staffing_adjustment"
        ? staffingAdjustment
        : planId === "bottleneck_mitigation"
          ? bottleneckMitigation
          : planId === "campaign_sequencing"
            ? campaignSequencing
            : planId === "governance_scheduling"
              ? governanceScheduling
              : planId === "escalation_response"
                ? escalationResponse
                : planId === "workload_balance"
                  ? workloadBalance
                  : planId === "executive_initiative"
                    ? executiveInitiative
                    : multiDepartment;

  const skipperSummary = [
    "Executive planning (advisory only — no autonomous execution):",
    `Primary plan: ${primary.title} (${primary.confidence} confidence, ${primary.steps.length} steps).`,
    `Desk: ${overview.totals.activeOrders} active, ${overview.totals.stalledOrders} stalled, ${overview.totals.pendingApprovals} pending approvals.`,
    "All steps reversible and require human approval before any write action.",
  ].join(" ");

  return {
    planId,
    horizonDays: horizon,
    multiDepartment,
    operationalRecovery,
    staffingAdjustment,
    bottleneckMitigation,
    campaignSequencing,
    governanceScheduling,
    escalationResponse,
    workloadBalance,
    executiveInitiative,
    confidence: cal.confidence,
    confidenceScore: cal.score,
    evidence: cal.evidence,
    skipperSummary,
    generatedAt: new Date().toISOString(),
    meta: {
      planningOnly: true,
      advisoryOnly: true,
      noAutonomousExecution: true,
      noProductionMutation: true,
      explainable: true,
      evidenceLinked: true,
      reversible: true,
    },
  };
}
