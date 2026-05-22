import type { ClientFulfillmentOrderSnapshot, OperationalBottleneck } from "@/lib/fulfillment/fulfillment-orchestration-types";
import type { BottleneckForecast, ForecastConfidence } from "@/lib/fulfillment/executive-kpi-forecast-types";

function confidenceFromSample(count: number): ForecastConfidence {
  if (count >= 5) return "high";
  if (count >= 2) return "medium";
  return "low";
}

export function buildBottleneckForecasts(input: {
  bottlenecks: OperationalBottleneck[];
  snapshots: ClientFulfillmentOrderSnapshot[];
}): BottleneckForecast[] {
  const active = input.snapshots.filter(
    (o) => o.pipelineStage !== "released" && o.pipelineStage !== "closed"
  );

  return input.bottlenecks.slice(0, 12).map((bottleneck) => {
    const matching = active.filter(
      (o) => o.department === bottleneck.department && o.pipelineStage === bottleneck.stage
    );
    const avgDays =
      matching.length > 0
        ? matching.reduce((s, o) => s + o.daysInCurrentStage, 0) / matching.length
        : 0;
    const growthRate = matching.filter((o) => o.daysInCurrentStage >= 5).length;
    const projectedOrderCount = Math.round(bottleneck.orderCount + growthRate * 0.35);
    const daysToEscalation =
      avgDays >= 10 ? 3 : avgDays >= 7 ? 7 : avgDays >= 5 ? 14 : null;
    const confidence = confidenceFromSample(bottleneck.orderCount);

    return {
      bottleneck,
      projectedOrderCount: Math.max(bottleneck.orderCount, projectedOrderCount),
      daysToEscalation,
      confidence,
      rationale: `${bottleneck.department} stage "${bottleneck.stage}" has ${bottleneck.orderCount} active order(s); ${growthRate} approaching stall threshold — forecast advisory only.`,
    };
  });
}
