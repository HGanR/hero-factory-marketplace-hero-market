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
    revenueOsRevisionRate: revisionStats.revenueOsAvgRevisionRound > 0 ? revisionStats.revenueOsAvgRevisionRound / 4 : 0,
    revenueOsLaunchBlockedRate: revisionStats.revenueOsLaunchBlockedRate,
    memoryItemTitles: input.memoryItemTitles,
  });

  const headline =
    highlights.trustStalledPackets > 0 ||
    highlights.revenueOsLaunchBlocked > 0 ||
    highlights.clientsNeedingGuidance > 0
      ? `Operational memory: ${highlights.clientsNeedingGuidance} client(s) need guidance; TRUST stalls ${highlights.trustStalledPackets}; REVENUE_OS launch blocked ${highlights.revenueOsLaunchBlocked}.`
      : `Operational memory: ${memory.ordersAnalyzed} fulfillment order(s) analyzed — WEBSITE/TRUST/REVENUE_OS weights applied.`;

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
    `WEBSITE avg draft v${revisionStats.websiteAvgDraftVersion}; revision-request ${Math.round(revisionStats.websiteRevisionRequestedRate * 100)}%.`,
    `REVENUE_OS avg revision round ${revisionStats.revenueOsAvgRevisionRound}; launch-approval pending rate ${Math.round(revisionStats.revenueOsLaunchBlockedRate * 100)}%.`,
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
