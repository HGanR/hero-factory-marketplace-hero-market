import type {
  CrisisCoordinationResult,
  ExecutiveCommandEngineInput,
} from "@/lib/executive-agent/executive-command-types";
import { buildIncidentIntelligence } from "@/lib/executive-agent/incident-intelligence";
import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";

export function coordinateOperationalCrisis(
  input: ExecutiveCommandEngineInput
): CrisisCoordinationResult {
  const incidents = buildIncidentIntelligence(input);
  const high = incidents.incidents.filter((i) => i.severity === "critical" || i.severity === "high");
  const affectedDepartments = [
    ...new Set(
      high.map((i) => i.department).filter(Boolean) as FulfillmentOrchestrationDepartment[]
    ),
  ];

  const crisisLevel =
    incidents.incidents.some((i) => i.category === "cross_department_crisis")
      ? "critical"
      : high.length >= 3
        ? "high"
        : high.length >= 1
          ? "medium"
          : "watch";

  const coordinationSteps: string[] = [];
  if (crisisLevel === "critical" || crisisLevel === "high") {
    coordinationSteps.push("Executive owner command review — triage incidents by severity (advisory)");
    coordinationSteps.push("Pause new write proposals until approval backlog assessed — recommendation only");
  }
  if (affectedDepartments.includes("SMART_TRUST")) {
    coordinationSteps.push("SMART_TRUST desk: governance checkpoint review — no autonomous trust execution");
  }
  if (affectedDepartments.includes("REVENUE_OS")) {
    coordinationSteps.push("REVENUE_OS desk: campaign degradation watch — no autonomous launch/publish");
  }
  if (affectedDepartments.length >= 2) {
    coordinationSteps.push("Cross-department sequencing sync via subject workspace — read-only coordination");
  }
  if (coordinationSteps.length === 0) {
    coordinationSteps.push("No crisis coordination required — maintain standard command watch");
  }

  return {
    crisisLevel,
    affectedDepartments,
    coordinationSteps,
    evidence: [
      { source: "inference", detail: `${high.length} high/critical incident(s)` },
      ...incidents.evidence,
    ],
    advisoryOnly: true,
  };
}
