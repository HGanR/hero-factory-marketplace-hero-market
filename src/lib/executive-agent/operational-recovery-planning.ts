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

export function buildOperationalRecoveryPlan(
  input: ExecutivePlanningEngineInput,
  horizonDays: number
): PlanningModuleResult {
  const ctx = buildPlanningScenarioContext(input, "operational_recovery", horizonDays);
  const steps: PlanningStep[] = [];

  if (ctx.stalledOrders > 0) {
    steps.push(
      step(
        1,
        "Review stalled orders by department — identify approval vs. desk blockers",
        "executive_owner",
        null,
        `${ctx.stalledOrders} order(s) exceed stage dwell threshold`
      )
    );
  }
  if (ctx.pendingApprovals > 0) {
    steps.push(
      step(
        steps.length + 1,
        "Clear owner approval backlog before new proposals",
        "executive_owner",
        null,
        `${ctx.pendingApprovals} pending approval gate(s)`
      )
    );
  }
  if (ctx.blockedTasks > 0) {
    steps.push(
      step(
        steps.length + 1,
        "Unblock operational tasks — resolve dependencies or defer non-critical work",
        "fulfillment_coordinator",
        null,
        `${ctx.blockedTasks} blocked task(s) on desk`
      )
    );
  }
  if (steps.length === 0) {
    steps.push(
      step(
        1,
        "Maintain recovery watch — no critical stall cluster detected",
        "fulfillment_coordinator",
        null,
        "Desk within normal recovery thresholds"
      )
    );
  }

  const confidence = ctx.stalledOrders >= 3 ? "high" : ctx.stalledOrders >= 1 ? "medium" : "low";

  return {
    planId: "operational_recovery",
    title: "Fulfillment recovery plan",
    summary: `Advisory ${horizonDays}-day recovery sequence — human approval required for each action; no autonomous execution.`,
    steps,
    confidence,
    confidenceScore: confidence === "high" ? 0.82 : confidence === "medium" ? 0.62 : 0.4,
    evidence: ctx.evidence,
    advisoryOnly: true,
    planningOnly: true,
    noAutonomousExecution: true,
  };
}
