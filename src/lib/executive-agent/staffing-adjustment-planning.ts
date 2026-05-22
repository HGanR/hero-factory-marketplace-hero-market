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

export function buildStaffingAdjustmentPlan(
  input: ExecutivePlanningEngineInput,
  horizonDays: number
): PlanningModuleResult {
  const ctx = buildPlanningScenarioContext(input, "staffing_adjustment", horizonDays);
  const overloaded = input.operatorWorkload.filter((w) => w.balanceLabel === "overloaded");
  const underloaded = input.operatorWorkload.filter((w) => w.balanceLabel === "underloaded");
  const steps: PlanningStep[] = [];

  for (const o of overloaded.slice(0, 2)) {
    const target = underloaded.find((u) => u.department === o.department || u.department === null);
    steps.push(
      step(
        steps.length + 1,
        `Advisory: propose delegation review from ${o.label} to ${target?.label ?? "department_lead"} — owner must approve`,
        "executive_owner",
        o.department,
        `Load index ${o.loadIndex}; ${o.openTasks} open tasks — planning only, no auto-reassign`
      )
    );
  }

  if (steps.length === 0) {
    steps.push(
      step(
        1,
        "Staffing balanced — monitor weekly; no adjustment recommended",
        "department_lead",
        null,
        "No overloaded operators in current window"
      )
    );
  }

  return {
    planId: "staffing_adjustment",
    title: "Staffing adjustment plan",
    summary: "Recommendations for load redistribution — requires explicit delegation approval; never autonomous reassignment.",
    steps,
    confidence: overloaded.length >= 2 ? "high" : overloaded.length >= 1 ? "medium" : "low",
    confidenceScore: overloaded.length >= 1 ? 0.75 : 0.45,
    evidence: [
      ...ctx.evidence,
      { source: "operators", detail: `${overloaded.length} overloaded role(s) analyzed` },
    ],
    advisoryOnly: true,
    planningOnly: true,
    noAutonomousExecution: true,
  };
}
