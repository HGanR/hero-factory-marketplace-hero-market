import type {
  ExecutivePlanningEngineInput,
  PlanningModuleResult,
  PlanningStep,
} from "@/lib/executive-agent/executive-planning-types";
import { buildPlanningScenarioContext } from "@/lib/executive-agent/planning-scenario-builder";

function step(
  order: number,
  action: string,
  owner: string,
  department: PlanningStep["department"],
  rationale: string
): PlanningStep {
  return {
    order,
    action,
    owner,
    department,
    rationale,
    requiresHumanApproval: true,
    reversible: true,
  };
}

export function buildCampaignSequencingPlan(
  input: ExecutivePlanningEngineInput,
  horizonDays: number
): PlanningModuleResult {
  const ctx = buildPlanningScenarioContext(input, "campaign_sequencing", horizonDays);
  const revenueOrders = input.kpi.snapshots.filter((s) => s.department === "REVENUE_OS");
  const steps: PlanningStep[] = [];

  const pendingLaunch = revenueOrders.filter(
    (s) => s.approvalStatus === "pending" || s.pipelineStage.includes("review")
  );
  if (pendingLaunch.length > 0) {
    steps.push(
      step(
        1,
        "Complete campaign review packet approvals before launch readiness checkpoint",
        "revenue_os_desk_lead",
        "REVENUE_OS",
        `${pendingLaunch.length} REVENUE_OS order(s) in review/approval path`
      )
    );
  }
  const websiteApproved = input.kpi.snapshots.some(
    (s) => s.department === "WEBSITE" && s.approvalStatus === "approved"
  );
  if (websiteApproved && revenueOrders.length === 0) {
    steps.push(
      step(
        steps.length + 1,
        "Advisory cross-sell: evaluate REVENUE_OS onboarding after WEBSITE approval — no auto campaign creation",
        "executive_owner",
        "REVENUE_OS",
        "WEBSITE approved; no active REVENUE_OS fulfillment order"
      )
    );
  }
  if (steps.length === 0) {
    steps.push(
      step(
        1,
        "Campaign sequencing nominal — maintain launch readiness watch",
        "revenue_os_desk_lead",
        "REVENUE_OS",
        "No sequencing conflict detected"
      )
    );
  }

  return {
    planId: "campaign_sequencing",
    title: "Campaign sequencing plan",
    summary: "REVENUE_OS launch sequencing — never autonomous launch, publish, or spend.",
    steps,
    confidence: revenueOrders.length >= 2 ? "high" : revenueOrders.length >= 1 ? "medium" : "low",
    confidenceScore: 0.7,
    evidence: [
      ...ctx.evidence,
      { source: "snapshots", detail: `${revenueOrders.length} REVENUE_OS order(s)` },
    ],
    advisoryOnly: true,
    planningOnly: true,
    noAutonomousExecution: true,
  };
}
