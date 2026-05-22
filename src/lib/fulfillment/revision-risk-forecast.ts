import type { ClientLifecycleInsight, FulfillmentOutcomeRecord } from "@/lib/fulfillment/fulfillment-operational-memory-types";
import type { ClientFulfillmentOrderSnapshot } from "@/lib/fulfillment/fulfillment-orchestration-types";
import type { ForecastConfidence, RevisionRiskForecast } from "@/lib/fulfillment/executive-kpi-forecast-types";

function confidenceFromBurden(burden: "medium" | "high", sample: number): ForecastConfidence {
  if (burden === "high" && sample >= 2) return "high";
  if (burden === "high" || sample >= 3) return "medium";
  return "low";
}

export function buildRevisionRiskForecasts(input: {
  snapshots: ClientFulfillmentOrderSnapshot[];
  outcomes: FulfillmentOutcomeRecord[];
  clientLifecycle: ClientLifecycleInsight[];
}): RevisionRiskForecast[] {
  const byClient = new Map<string, ClientFulfillmentOrderSnapshot[]>();
  for (const o of input.snapshots) {
    const list = byClient.get(o.clientId) ?? [];
    list.push(o);
    byClient.set(o.clientId, list);
  }

  const forecasts: RevisionRiskForecast[] = [];

  for (const insight of input.clientLifecycle) {
    if (insight.revisionBurden === "low") continue;
    const orders = byClient.get(insight.clientId) ?? [];
    const revisionOutcomes = input.outcomes.filter(
      (o) => o.clientId === insight.clientId && o.outcome === "revision_heavy"
    );
    const revisionOrders = orders.filter((o) => (o.revisionRound ?? 0) >= 2);
    if (!revisionOrders.length && !revisionOutcomes.length) continue;

    const burden = insight.revisionBurden === "high" ? "high" : "medium";
    const projectedDelayDays = burden === "high" ? 10 : 6;
    forecasts.push({
      clientId: insight.clientId,
      orderIds: revisionOrders.map((o) => o.orderId),
      revisionBurden: burden,
      projectedDelayDays,
      confidence: confidenceFromBurden(burden, revisionOutcomes.length + revisionOrders.length),
      rationale: `Client shows ${burden} revision burden — owner review cycles may extend fulfillment velocity.`,
      memoryEvidence:
        revisionOutcomes.length > 0
          ? `Operational memory: ${revisionOutcomes.length} revision_heavy outcome(s) on desk.`
          : null,
    });
  }

  for (const o of input.snapshots) {
    if ((o.revisionRound ?? 0) < 3) continue;
    if (forecasts.some((f) => f.clientId === o.clientId)) continue;
    forecasts.push({
      clientId: o.clientId,
      orderIds: [o.orderId],
      revisionBurden: "high",
      projectedDelayDays: 12,
      confidence: "medium",
      rationale: `Order ${o.orderId.slice(0, 8)}… has ${o.revisionRound} revision round(s) in ${o.department}.`,
      memoryEvidence: null,
    });
  }

  return forecasts.sort((a, b) => b.projectedDelayDays - a.projectedDelayDays).slice(0, 15);
}
