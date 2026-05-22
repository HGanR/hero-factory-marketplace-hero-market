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

export function buildWorkloadBalancePlan(
  input: ExecutivePlanningEngineInput,
  horizonDays: number
): PlanningModuleResult {
  const ctx = buildPlanningScenarioContext(input, "workload_balance", horizonDays);
  const balance = input.operatorWorkload;

  const steps: PlanningStep[] = [];
  const byDept = new Map<string, number>();
  for (const w of balance) {
    if (w.department) byDept.set(w.department, (byDept.get(w.department) ?? 0) + w.loadIndex);
  }

  const sorted = [...byDept.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length >= 2 && sorted[0]![1] - sorted[sorted.length - 1]![1] > 40) {
    steps.push(
      step(
        1,
        `Strategic workload rebalance advisory: reduce pressure on ${sorted[0]![0]} desk`,
        "department_lead",
        sorted[0]![0] as PlanningStep["department"],
        `Load spread ${sorted[0]![1]} vs ${sorted[sorted.length - 1]![1]} — planning only`
      )
    );
    steps.push(
      step(
        2,
        "Align open decisions and tasks with department capacity — defer low-priority items",
        "executive_owner",
        null,
        `${input.openDecisionCount} open decision(s) in ledger`
      )
    );
  } else {
    steps.push(
      step(
        1,
        "Workload balance within tolerance — maintain weekly review",
        "department_lead",
        null,
        "Inter-department load spread acceptable"
      )
    );
  }

  return {
    planId: "workload_balance",
    title: "Strategic workload balancing plan",
    summary: `Cross-desk balance over ${horizonDays} days — reversible recommendations only.`,
    steps,
    confidence: sorted.length >= 2 ? "medium" : "low",
    confidenceScore: 0.58,
    evidence: ctx.evidence,
    advisoryOnly: true,
    planningOnly: true,
    noAutonomousExecution: true,
  };
}
