import type { ExecutiveFulfillmentOperationalMemoryInsightsDto } from "@/lib/fulfillment/fulfillment-operational-memory-types";
import {
  buildOperationalMemoryStore,
  buildRevisionThemeHints,
  computeRevisionAnalytics,
  summarizeMemoryHighlights,
} from "@/lib/fulfillment/operational-memory-store";
import type { OperationalMemoryBuildInput } from "@/lib/fulfillment/fulfillment-operational-memory-types";

export function buildExecutiveFulfillmentOperationalMemoryInsights(
  input: OperationalMemoryBuildInput
): ExecutiveFulfillmentOperationalMemoryInsightsDto {
  const memory = buildOperationalMemoryStore(input);
  const highlights = summarizeMemoryHighlights(memory);
  const revisionStats = computeRevisionAnalytics(input.orders);
  const topRevisionThemes = buildRevisionThemeHints({
    websiteRevisionRate: revisionStats.websiteRevisionRequestedRate,
    trustStallRate: revisionStats.trustOwnerReviewPendingRate,
    memoryItemTitles: input.memoryItemTitles,
  });

  const headline =
    highlights.trustStalledPackets > 0 || highlights.clientsNeedingGuidance > 0
      ? `Operational memory: ${highlights.clientsNeedingGuidance} client(s) need extra guidance; ${highlights.trustStalledPackets} TRUST stall signal(s).`
      : `Operational memory: ${memory.ordersAnalyzed} fulfillment order(s) analyzed — recommendations weighted from desk patterns.`;

  const lines = [
    headline,
    highlights.topOwnerPriority
      ? `Owner focus pattern: ${highlights.topOwnerPriority}.`
      : null,
    highlights.fastestApprovalFlow
      ? `Fastest approval flow: ${highlights.fastestApprovalFlow}.`
      : null,
    highlights.topEffectiveRecommendation
      ? `Most effective recommendation type: ${highlights.topEffectiveRecommendation}.`
      : null,
    highlights.recurringBottleneck
      ? `Recurring bottleneck: ${highlights.recurringBottleneck}.`
      : null,
    `WEBSITE avg draft v${revisionStats.websiteAvgDraftVersion}; revision-request rate ${Math.round(revisionStats.websiteRevisionRequestedRate * 100)}%.`,
    "Read-only learning — no autonomous execution, workflow mutation, or client-facing adaptation.",
  ].filter(Boolean);

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    headline,
    skipperSummary: lines.join(" "),
    memory,
    highlights,
    revisionAnalytics: {
      ...revisionStats,
      topRevisionThemes,
    },
    meta: {
      recommendationOnly: true,
      noAutonomousExecution: true,
      noAutonomousLearningActions: true,
      readOnlyAnalytics: true,
    },
  };
}
