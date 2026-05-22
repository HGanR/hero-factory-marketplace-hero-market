import type { ApprovalLatencyRecord } from "@/lib/fulfillment/fulfillment-operational-memory-types";
import type { ClientFulfillmentOrderSnapshot } from "@/lib/fulfillment/fulfillment-orchestration-types";
import type { ApprovalDelayForecast, ForecastConfidence } from "@/lib/fulfillment/executive-kpi-forecast-types";

function mapActionToLabel(action: string): string {
  return action.replace(/([A-Z])/g, " $1").trim();
}

function confidenceFromSamples(n: number): ForecastConfidence {
  if (n >= 4) return "high";
  if (n >= 2) return "medium";
  return "low";
}

export function buildApprovalDelayForecasts(input: {
  snapshots: ClientFulfillmentOrderSnapshot[];
  approvalLatency: ApprovalLatencyRecord[];
}): ApprovalDelayForecast[] {
  const pending = input.snapshots.filter((o) => o.approvalStatus === "pending");
  const byAction = new Map<string, { department: ApprovalDelayForecast["department"]; count: number }>();

  for (const o of pending) {
    const key = `${o.department}:pending`;
    const hit = byAction.get(key);
    if (hit) hit.count += 1;
    else byAction.set(key, { department: o.department, count: 1 });
  }

  const latencyByAction = new Map(
    input.approvalLatency.map((r) => [r.proposedAction, r] as const)
  );

  const forecasts: ApprovalDelayForecast[] = [];

  for (const [key, v] of byAction.entries()) {
    const dept = v.department;
    const matchingLatency = [...latencyByAction.values()].filter(
      (l) => !l.department || l.department === dept
    );
    const median =
      matchingLatency.length > 0
        ? matchingLatency.reduce((s, l) => s + (l.medianHoursToExecute ?? 48), 0) /
          matchingLatency.length
        : 48;

    forecasts.push({
      proposedAction: key,
      department: dept,
      pendingCount: v.count,
      projectedMedianHours: Math.round(median * 10) / 10,
      confidence: confidenceFromSamples(matchingLatency.reduce((s, l) => s + l.sampleCount, 0)),
      rationale: `${v.count} pending approval(s) on ${dept ?? "desk"} — historical median ~${Math.round(median)}h (memory-backed when available). No automatic approval.`,
    });
  }

  for (const lat of input.approvalLatency.slice(0, 8)) {
    if ((lat.medianHoursToExecute ?? 0) < 72) continue;
    if (forecasts.some((f) => f.proposedAction === lat.proposedAction)) continue;
    forecasts.push({
      proposedAction: lat.proposedAction,
      department: lat.department,
      pendingCount: 0,
      projectedMedianHours: lat.medianHoursToExecute,
      confidence: confidenceFromSamples(lat.sampleCount),
      rationale: `${mapActionToLabel(lat.proposedAction)} historically slow (${lat.medianHoursToExecute}h median, n=${lat.sampleCount}) — watch approval bottlenecks.`,
    });
  }

  return forecasts.sort((a, b) => (b.pendingCount ?? 0) - (a.pendingCount ?? 0)).slice(0, 12);
}
