import type {
  BottleneckRecurrenceRecord,
  OperationalMemoryOrderRecord,
} from "@/lib/fulfillment/fulfillment-operational-memory-types";
import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";

const RECURRENCE_STALL_DAYS = 5;

export function analyzeBottleneckRecurrence(
  orders: OperationalMemoryOrderRecord[]
): BottleneckRecurrenceRecord[] {
  const map = new Map<
    string,
    {
      department: FulfillmentOrchestrationDepartment;
      stage: string;
      currentOrderCount: number;
      repeatVisits: number;
    }
  >();

  for (const o of orders) {
    if (o.pipelineStage === "released" || o.pipelineStage === "closed") continue;
    const key = `${o.department}:${o.pipelineStage}`;
    const hit = map.get(key);
    const repeat = o.daysInCurrentStage >= RECURRENCE_STALL_DAYS ? 1 : 0;
    if (hit) {
      hit.currentOrderCount += 1;
      hit.repeatVisits += repeat;
    } else {
      map.set(key, {
        department: o.department,
        stage: o.pipelineStage,
        currentOrderCount: 1,
        repeatVisits: repeat,
      });
    }
  }

  return [...map.entries()]
    .map(([id, v]) => {
      const recurrenceScore = Math.min(
        1,
        (v.repeatVisits / Math.max(1, v.currentOrderCount)) * 0.6 + (v.currentOrderCount > 2 ? 0.4 : 0)
      );
      return {
        id,
        department: v.department,
        stage: v.stage,
        currentOrderCount: v.currentOrderCount,
        recurrenceScore: Math.round(recurrenceScore * 100) / 100,
        repeatVisits: v.repeatVisits,
        summary:
          v.repeatVisits > 0
            ? `${v.currentOrderCount} order(s) stuck in "${v.stage.replace(/_/g, " ")}" — ${v.repeatVisits} long-running`
            : `${v.currentOrderCount} order(s) in "${v.stage.replace(/_/g, " ")}"`,
      };
    })
    .sort((a, b) => b.recurrenceScore - a.recurrenceScore || b.currentOrderCount - a.currentOrderCount);
}
