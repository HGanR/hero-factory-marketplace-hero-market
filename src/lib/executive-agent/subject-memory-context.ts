import type { ExecutiveFulfillmentOperationalMemoryInsightsDto } from "@/lib/fulfillment/fulfillment-operational-memory-types";
import type {
  ClientFulfillmentOrderSnapshot,
  FulfillmentRecommendation,
  UnifiedTimelineEntry,
} from "@/lib/fulfillment/fulfillment-orchestration-types";
import type { SubjectWorkspaceScope } from "@/lib/executive-agent/subject-workspace-state";

export type SubjectMemoryHighlights = {
  websiteLowRevisionDrafts: number;
  trustStalledPackets: number;
  revenueOsLaunchBlocked: number;
  revenueOsCampaignStalled: number;
  clientsNeedingGuidance: number;
  topEffectiveRecommendation: string | null;
  recurringBottleneck: string | null;
  revisionThemes: string[];
};

export function filterOrdersForScope(
  orders: ClientFulfillmentOrderSnapshot[],
  scope: SubjectWorkspaceScope
): ClientFulfillmentOrderSnapshot[] {
  let list = orders;
  if (scope.department) {
    list = list.filter((o) => o.department === scope.department);
  }
  if (scope.orderId) {
    list = list.filter((o) => o.orderId === scope.orderId);
  }
  return list;
}

export function filterTimelineForScope(
  timeline: UnifiedTimelineEntry[],
  scope: SubjectWorkspaceScope
): UnifiedTimelineEntry[] {
  let list = timeline;
  if (scope.department) {
    list = list.filter((t) => t.department === scope.department || t.department == null);
  }
  if (scope.orderId) {
    list = list.filter((t) => t.orderId === scope.orderId || t.orderId == null);
  }
  return list.slice(0, 24);
}

export function filterRecommendationsForScope(
  recommendations: FulfillmentRecommendation[],
  scope: SubjectWorkspaceScope
): FulfillmentRecommendation[] {
  let list = recommendations;
  if (scope.department) {
    list = list.filter(
      (r) => r.department === scope.department || r.department == null
    );
  }
  if (scope.orderId) {
    list = list.filter(
      (r) => r.relatedOrderIds.includes(scope.orderId!) || r.relatedOrderIds.length === 0
    );
  }
  return list.slice(0, 12);
}

export function extractSubjectMemoryHighlights(
  insights: ExecutiveFulfillmentOperationalMemoryInsightsDto | null,
  scope: SubjectWorkspaceScope
): SubjectMemoryHighlights | null {
  if (!insights?.ok) return null;
  const mem = insights.memory;
  const dept = scope.department;

  const outcomes = dept
    ? mem.outcomes.filter((o) => o.department === dept)
    : mem.outcomes;

  const bottlenecks = dept
    ? mem.bottleneckRecurrence.filter((b) => b.department === dept)
    : mem.bottleneckRecurrence;

  const clientGuidance =
    scope.clientId != null
      ? mem.clientLifecycle.filter((c) => c.clientId === scope.clientId)
      : mem.clientLifecycle.filter((c) => c.guidanceScore >= 55);

  return {
    websiteLowRevisionDrafts: outcomes.filter((o) => o.outcome === "website_draft_low_revision").length,
    trustStalledPackets: outcomes.filter((o) => o.outcome === "trust_packet_stalled").length,
    revenueOsLaunchBlocked: outcomes.filter((o) => o.outcome === "revenue_os_launch_blocked").length,
    revenueOsCampaignStalled: outcomes.filter((o) => o.outcome === "revenue_os_campaign_stalled").length,
    clientsNeedingGuidance: clientGuidance.length,
    topEffectiveRecommendation: insights.highlights.topEffectiveRecommendation,
    recurringBottleneck: bottlenecks[0]?.summary ?? insights.highlights.recurringBottleneck,
    revisionThemes: insights.revisionAnalytics.topRevisionThemes,
  };
}

export function buildSubjectSkipperContext(input: {
  scope: SubjectWorkspaceScope;
  headline: string;
  timelineSummary?: string | null;
  skipperBrief?: string | null;
  recommendations: FulfillmentRecommendation[];
  memoryHighlights: SubjectMemoryHighlights | null;
  activeOrderIds: string[];
}): string {
  const { scope } = input;
  const recTitles = input.recommendations.slice(0, 5).map((r) => r.title);
  const mem = input.memoryHighlights;

  const lines = [
    `Active subject: ${scope.label}`,
    `Workspace kind: ${scope.workspaceKind}`,
    scope.department ? `Department: ${scope.department}` : null,
    scope.clientId ? `Client: ${scope.clientId}` : null,
    scope.orderId ? `Fulfillment order: ${scope.orderId}` : null,
    input.activeOrderIds.length
      ? `Related orders: ${input.activeOrderIds.map((id) => id.slice(0, 8)).join(", ")}`
      : null,
    input.headline,
    input.skipperBrief ? `Brief: ${input.skipperBrief}` : null,
    input.timelineSummary ? `Timeline: ${input.timelineSummary}` : null,
    recTitles.length ? `Recommendations: ${recTitles.join("; ")}` : null,
    mem?.recurringBottleneck ? `Memory bottleneck: ${mem.recurringBottleneck}` : null,
    mem?.topEffectiveRecommendation
      ? `Effective recommendation pattern: ${mem.topEffectiveRecommendation}`
      : null,
    scope.department === "WEBSITE" && mem
      ? `WEBSITE low-revision signals: ${mem.websiteLowRevisionDrafts}`
      : null,
    scope.department === "TRUST" && mem ? `TRUST stall signals: ${mem.trustStalledPackets}` : null,
    scope.department === "REVENUE_OS" && mem
      ? `REVENUE_OS launch blocked: ${mem.revenueOsLaunchBlocked}; campaign stalled: ${mem.revenueOsCampaignStalled}`
      : null,
    mem && mem.clientsNeedingGuidance > 0
      ? `Clients needing guidance: ${mem.clientsNeedingGuidance}`
      : null,
    "Read-only — recommendations only; no autonomous execution, deploy, publish, launch, ad spend, or Content360 bypass.",
  ].filter(Boolean);

  return lines.join(" ");
}
