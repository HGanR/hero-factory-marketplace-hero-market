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

export function buildBottleneckMitigationPlan(
  input: ExecutivePlanningEngineInput,
  horizonDays: number
): PlanningModuleResult {
  const ctx = buildPlanningScenarioContext(input, "bottleneck_mitigation", horizonDays);
  const bottlenecks = input.kpi.bottlenecks.slice(0, 5);
  const steps: PlanningStep[] = bottlenecks.map((b, i) =>
    step(
      i + 1,
      `Mitigate ${b.department} bottleneck at ${b.stage} — executive review before any stage override`,
      b.department === "WEBSITE"
        ? "website_desk_lead"
        : b.department === "TRUST"
          ? "trust_desk_lead"
          : b.department === "REVENUE_OS"
            ? "revenue_os_desk_lead"
            : "smart_trust_desk_lead",
      b.department,
      `${b.summary} (${b.orderCount} order(s))`
    )
  );

  if (steps.length === 0) {
    steps.push(
      step(
        1,
        "Continue bottleneck monitoring — no recurrence cluster above threshold",
        "fulfillment_coordinator",
        null,
        "KPI bottleneck list empty or low severity"
      )
    );
  }

  return {
    planId: "bottleneck_mitigation",
    title: "Bottleneck mitigation plan",
    summary: `Sequence to reduce stage stalls over ${horizonDays} days — advisory only.`,
    steps,
    confidence: bottlenecks.length >= 2 ? "high" : bottlenecks.length >= 1 ? "medium" : "low",
    confidenceScore: bottlenecks.length >= 1 ? 0.78 : 0.42,
    evidence: [
      ...ctx.evidence,
      { source: "kpi", detail: `${bottlenecks.length} bottleneck record(s)` },
    ],
    advisoryOnly: true,
    planningOnly: true,
    noAutonomousExecution: true,
  };
}
