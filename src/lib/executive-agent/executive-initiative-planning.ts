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

export function buildExecutiveInitiativePlan(
  input: ExecutivePlanningEngineInput,
  horizonDays: number
): PlanningModuleResult {
  const ctx = buildPlanningScenarioContext(input, "executive_initiative", horizonDays);
  const steps: PlanningStep[] = [];

  if (input.strategicPriorityTitles.length > 0) {
    steps.push(
      step(
        1,
        `Initiative anchor: ${input.strategicPriorityTitles[0]!.slice(0, 80)}`,
        "executive_owner",
        null,
        "From persisted strategic priority memory"
      )
    );
  }

  steps.push(
    step(
      steps.length + 1,
      "Weekly executive initiative review — align simulation + knowledge graph insights",
      "executive_owner",
      null,
      "Combine forecasting, simulation, and knowledge intelligence"
    )
  );

  if (ctx.focusDepartments.length >= 3) {
    steps.push(
      step(
        steps.length + 1,
        "Multi-department initiative: coordinate sequencing across WEBSITE/TRUST/REVENUE_OS/SMART_TRUST",
        "department_lead",
        null,
        `${ctx.focusDepartments.length} active departments`
      )
    );
  }

  steps.push(
    step(
      steps.length + 1,
      "Close initiative loop — record outcomes in decision ledger; no autonomous status changes",
      "executive_owner",
      null,
      "Reversible roadmap — owner may defer or supersede any step"
    )
  );

  return {
    planId: "executive_initiative",
    title: "Executive initiative roadmap",
    summary: `Advisory ${horizonDays}-day initiative plan — explainable, evidence-linked, human-gated.`,
    steps,
    confidence: input.strategicPriorityTitles.length >= 2 ? "high" : "medium",
    confidenceScore: 0.68,
    evidence: [
      ...ctx.evidence,
      {
        source: "memory",
        detail: `${input.strategicPriorityTitles.length} strategic priority title(s)`,
      },
    ],
    advisoryOnly: true,
    planningOnly: true,
    noAutonomousExecution: true,
  };
}
