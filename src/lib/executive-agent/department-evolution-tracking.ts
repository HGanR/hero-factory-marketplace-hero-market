import type {
  DepartmentEvolutionTrackingResult,
  ExecutiveKnowledgeEngineInput,
  KnowledgeEvidenceLink,
} from "@/lib/executive-agent/executive-knowledge-types";
import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";

const DEPTS: FulfillmentOrchestrationDepartment[] = [
  "WEBSITE",
  "TRUST",
  "REVENUE_OS",
  "SMART_TRUST",
];

export function trackDepartmentEvolution(
  input: ExecutiveKnowledgeEngineInput
): DepartmentEvolutionTrackingResult {
  const departments = DEPTS.map((department) => {
    const orders = input.snapshots.filter((s) => s.department === department);
    const active = orders.filter(
      (o) => o.pipelineStage !== "released" && o.pipelineStage !== "closed"
    );
    const avgDays =
      orders.length > 0
        ? Math.round(
            orders.reduce((sum, o) => sum + o.daysInCurrentStage, 0) / orders.length
          )
        : 0;
    const stageCounts = new Map<string, number>();
    for (const o of orders) {
      stageCounts.set(o.pipelineStage, (stageCounts.get(o.pipelineStage) ?? 0) + 1);
    }
    const dominantStage =
      [...stageCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "none";
    const stalled = orders.filter((o) => o.daysInCurrentStage >= 10).length;
    const trend: "expanding" | "stable" | "contracting" =
      active.length >= 3 && stalled >= 2
        ? "expanding"
        : active.length <= 1
          ? "contracting"
          : "stable";

    const evidence: KnowledgeEvidenceLink[] = [
      { source: "snapshots", detail: `${orders.length} ${department} orders tracked` },
    ];

    return {
      department,
      activeOrders: active.length,
      avgDaysInStage: avgDays,
      dominantStage,
      trend,
      evidence,
    };
  });

  const crossDepartmentLinks = input.snapshots.filter((s) => s.clientId).length;

  return {
    departments,
    crossDepartmentLinks,
    confidence: input.snapshots.length >= 8 ? "high" : input.snapshots.length >= 3 ? "medium" : "low",
    evidence: [{ source: "snapshots", detail: "Department evolution from fulfillment snapshots" }],
    advisoryOnly: true,
  };
}
