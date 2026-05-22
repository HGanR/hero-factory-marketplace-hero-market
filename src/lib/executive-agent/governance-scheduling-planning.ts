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

export function buildGovernanceSchedulingPlan(
  input: ExecutivePlanningEngineInput,
  horizonDays: number
): PlanningModuleResult {
  const ctx = buildPlanningScenarioContext(input, "governance_scheduling", horizonDays);
  const smartTrust = input.kpi.snapshots.filter((s) => s.department === "SMART_TRUST");
  const steps: PlanningStep[] = [];

  const pendingGov = smartTrust.filter(
    (s) => s.approvalStatus === "pending" || s.daysInCurrentStage >= 8
  );
  if (pendingGov.length > 0) {
    steps.push(
      step(
        1,
        "Schedule governance review checkpoint — propose packet via approval queue only",
        "smart_trust_desk_lead",
        "SMART_TRUST",
        `${pendingGov.length} SMART_TRUST order(s) need governance attention`
      )
    );
    steps.push(
      step(
        2,
        "Record resolution/minutes after owner decision — no autonomous trust execution",
        "executive_owner",
        "SMART_TRUST",
        "Governed SMART_TRUST requires human approval for all writes"
      )
    );
  } else {
    steps.push(
      step(
        1,
        "Governance schedule clear — periodic compliance watch only",
        "smart_trust_desk_lead",
        "SMART_TRUST",
        "No pending governance cluster"
      )
    );
  }

  return {
    planId: "governance_scheduling",
    title: "Trust governance scheduling plan",
    summary: `SMART_TRUST governance cadence over ${horizonDays} days — planning only; no autonomous governance changes.`,
    steps,
    confidence: pendingGov.length >= 2 ? "high" : pendingGov.length >= 1 ? "medium" : "low",
    confidenceScore: pendingGov.length >= 1 ? 0.76 : 0.44,
    evidence: [
      ...ctx.evidence,
      { source: "snapshots", detail: `${smartTrust.length} SMART_TRUST order(s)` },
    ],
    advisoryOnly: true,
    planningOnly: true,
    noAutonomousExecution: true,
  };
}
