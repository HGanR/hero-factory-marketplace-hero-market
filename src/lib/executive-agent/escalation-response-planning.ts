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

export function buildEscalationResponsePlan(
  input: ExecutivePlanningEngineInput,
  horizonDays: number
): PlanningModuleResult {
  const ctx = buildPlanningScenarioContext(input, "escalation_response", horizonDays);
  const overdue = input.tasks.filter((t) => t.isOverdue && t.status !== "completed");
  const escalated = input.tasks.filter((t) => {
    const m = input.metadataByTaskId.get(t.id);
    return m?.escalation?.status === "proposed" || m?.escalation?.status === "approved";
  });

  const steps: PlanningStep[] = [];
  if (overdue.length > 0) {
    steps.push(
      step(
        1,
        "Triage overdue tasks — propose escalation chain climb with owner approval",
        "department_lead",
        null,
        `${overdue.length} overdue task(s)`
      )
    );
  }
  if (escalated.length > 0) {
    steps.push(
      step(
        steps.length + 1,
        "Review in-flight escalations — executive owner final tier if urgent",
        "executive_owner",
        null,
        `${escalated.length} task(s) with escalation metadata`
      )
    );
  }
  if (steps.length === 0) {
    steps.push(
      step(
        1,
        "Escalation response standby — no overdue or active escalation pressure",
        "fulfillment_coordinator",
        null,
        "Desk escalation risk low"
      )
    );
  }

  return {
    planId: "escalation_response",
    title: "Escalation response plan",
    summary: "Escalation handling sequence — never autonomous escalation execution.",
    steps,
    confidence: overdue.length >= 2 ? "high" : overdue.length >= 1 ? "medium" : "low",
    confidenceScore: overdue.length >= 1 ? 0.74 : 0.43,
    evidence: [
      ...ctx.evidence,
      { source: "tasks", detail: `${overdue.length} overdue, ${escalated.length} escalated` },
    ],
    advisoryOnly: true,
    planningOnly: true,
    noAutonomousExecution: true,
  };
}
