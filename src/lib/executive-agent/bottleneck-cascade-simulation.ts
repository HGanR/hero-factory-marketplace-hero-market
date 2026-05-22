import type {
  BottleneckCascadeSimulationResult,
  ExecutiveSimulationEngineInput,
} from "@/lib/executive-agent/executive-simulation-types";
import { detectOperationalBottlenecks } from "@/lib/fulfillment/fulfillment-recommendation-engine";

export function simulateBottleneckCascade(
  input: ExecutiveSimulationEngineInput
): BottleneckCascadeSimulationResult {
  const bottlenecks =
    input.kpi.bottlenecks.length > 0
      ? input.kpi.bottlenecks
      : detectOperationalBottlenecks(input.kpi.snapshots);

  const revisionHeavy = input.kpi.clientLifecycle.filter((c) => c.revisionBurden === "high").length;
  const stalled = input.kpi.snapshots.filter((o) => o.daysInCurrentStage >= 7).length;

  const projectedCascadeDepth = Math.min(
    4,
    bottlenecks.length + (stalled >= 3 ? 1 : 0) + (revisionHeavy >= 2 ? 1 : 0)
  );
  const departments = [...new Set(bottlenecks.map((b) => b.department))];
  const revisionCascadeRisk = Math.min(
    0.9,
    revisionHeavy * 0.15 + stalled * 0.05 + bottlenecks.length * 0.1
  );

  return {
    initialBottlenecks: bottlenecks.length,
    projectedCascadeDepth,
    affectedDepartments: departments,
    revisionCascadeRisk: Math.round(revisionCascadeRisk * 100) / 100,
    confidence: bottlenecks.length >= 2 ? "medium" : "low",
    evidence: [
      { source: "snapshots", detail: `${bottlenecks.length} bottleneck cluster(s)` },
      { source: "memory", detail: `${revisionHeavy} revision-heavy client(s)` },
    ],
    advisoryOnly: true,
  };
}
