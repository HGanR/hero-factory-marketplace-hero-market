import type { OperatorPriorityPattern } from "@/lib/fulfillment/fulfillment-operational-memory-types";

const ACTION_LABELS: Record<string, string> = {
  "fulfillment.operations.briefing": "Operations briefing review",
  "fulfillment.operations.overview": "Fulfillment desk overview",
  "fulfillment.operations.client": "Per-client fulfillment graph",
  "fulfillment.operations.memory_insights": "Operational memory insights",
  operations_briefing_viewed: "Briefing viewed",
  operations_overview_viewed: "Overview viewed",
  operations_client_viewed: "Client operations viewed",
  memory_insights_viewed: "Memory insights viewed",
  createSiteBuilderTask: "WEBSITE draft approval flow",
  createTrustFulfillmentPacket: "TRUST packet approval flow",
};

export function learnOperatorPriorityPatterns(input: {
  auditActions: Array<{ actionType: string; toolName: string }>;
  approvalActions: string[];
}): OperatorPriorityPattern[] {
  const counts = new Map<string, number>();

  for (const a of input.auditActions) {
    const key = a.actionType || a.toolName;
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const action of input.approvalActions) {
    counts.set(action, (counts.get(action) ?? 0) + 2);
  }

  const total = [...counts.values()].reduce((s, n) => s + n, 0) || 1;

  return [...counts.entries()]
    .map(([actionKey, occurrenceCount]) => ({
      actionKey,
      label: ACTION_LABELS[actionKey] ?? actionKey.replace(/[._]/g, " "),
      occurrenceCount,
      shareOfDeskActivity: Math.round((occurrenceCount / total) * 1000) / 1000,
    }))
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
    .slice(0, 12);
}
