import { analyzeBottleneckRecurrence } from "@/lib/fulfillment/bottleneck-analytics";
import { trackFulfillmentOutcomes } from "@/lib/fulfillment/fulfillment-outcome-tracker";
import type {
  ApprovalLatencyRecord,
  ClientLifecycleInsight,
  OperationalMemoryBuildInput,
  OperationalMemoryStoreSnapshot,
} from "@/lib/fulfillment/fulfillment-operational-memory-types";
import { scoreFulfillmentSuccess } from "@/lib/fulfillment/fulfillment-success-score";
import { learnOperatorPriorityPatterns } from "@/lib/fulfillment/operator-pattern-learning";
import {
  buildRecommendationEffectivenessSignals,
  buildRecommendationMemoryWeights,
} from "@/lib/fulfillment/recommendation-feedback";
import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

function hoursBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round((ms / (60 * 60 * 1000)) * 10) / 10;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function analyzeApprovalLatency(
  approvals: OperationalMemoryBuildInput["approvals"]
): ApprovalLatencyRecord[] {
  const byAction = new Map<
    string,
    { department: ApprovalLatencyRecord["department"]; hours: number[] }
  >();

  for (const a of approvals) {
    if (a.status !== "executed" && a.status !== "approved") continue;
    const h = hoursBetween(a.createdAt, a.executedAt);
    if (h == null) continue;
    const hit = byAction.get(a.proposedAction);
    if (hit) {
      hit.hours.push(h);
      if (!hit.department && a.department) hit.department = a.department;
    } else {
      byAction.set(a.proposedAction, { department: a.department, hours: [h] });
    }
  }

  return [...byAction.entries()].map(([proposedAction, v]) => ({
    proposedAction,
    department: v.department,
    sampleCount: v.hours.length,
    medianHoursToExecute: median(v.hours),
    fastestHours: v.hours.length ? Math.min(...v.hours) : null,
    slowestHours: v.hours.length ? Math.max(...v.hours) : null,
  }));
}

export function buildClientLifecycleInsights(
  orders: OperationalMemoryBuildInput["orders"],
  outcomes: ReturnType<typeof trackFulfillmentOutcomes>
): ClientLifecycleInsight[] {
  const byClient = new Map<string, typeof orders>();
  for (const o of orders) {
    const list = byClient.get(o.clientId) ?? [];
    list.push(o);
    byClient.set(o.clientId, list);
  }

  return [...byClient.entries()].map(([clientId, clientOrders]) => {
    const clientOutcomes = outcomes.filter((o) => o.clientId === clientId);
    const revisionHeavy = clientOutcomes.filter((o) => o.outcome === "revision_heavy").length;
    const revisionBurden: ClientLifecycleInsight["revisionBurden"] =
      revisionHeavy >= 2 ? "high" : revisionHeavy === 1 ? "medium" : "low";
    const guidanceScore =
      revisionBurden === "high" ? 85 : revisionBurden === "medium" ? 55 : 25;
    const departmentsActive = [...new Set(clientOrders.map((o) => o.department))];

    return {
      clientId,
      guidanceScore,
      revisionBurden,
      departmentsActive,
      insight:
        revisionBurden === "high"
          ? "Client tends to need more owner guidance through revision cycles."
          : revisionBurden === "medium"
            ? "Moderate revision history — proactive check-ins help."
            : "Lifecycle is steady — monitor for approval or payment gates only.",
    };
  });
}

export function buildRevisionThemeHints(input: {
  websiteRevisionRate: number;
  trustStallRate: number;
  revenueOsRevisionRate?: number;
  revenueOsLaunchBlockedRate?: number;
  memoryItemTitles: string[];
}): string[] {
  const themes: string[] = [];
  if (input.websiteRevisionRate > 0.25) themes.push("copy_tone");
  if (input.websiteRevisionRate > 0.4) themes.push("layout_structure");
  if (input.trustStallRate > 0.2) themes.push("legal_review_latency");
  if ((input.revenueOsRevisionRate ?? 0) > 0.3) themes.push("campaign_creative_revision");
  if ((input.revenueOsLaunchBlockedRate ?? 0) > 0.15) themes.push("launch_readiness_blocker");
  if (input.memoryItemTitles.some((t) => /approval|backlog/i.test(t))) themes.push("approval_backlog");
  if (input.memoryItemTitles.some((t) => /kpi|campaign|revenue/i.test(t))) themes.push("revenue_os_kpi");
  return themes.length ? themes : ["monitor_stage_dwell"];
}

export function buildOperationalMemoryStore(
  input: OperationalMemoryBuildInput
): OperationalMemoryStoreSnapshot {
  const outcomes = trackFulfillmentOutcomes(input.orders, input.revisionEventCounts);
  const recommendationSignals = buildRecommendationEffectivenessSignals(outcomes);
  const recommendationWeights = buildRecommendationMemoryWeights(recommendationSignals);
  const operatorPatterns = learnOperatorPriorityPatterns({
    auditActions: input.auditActions,
    approvalActions: input.approvals.map((a) => a.proposedAction),
  });
  const bottleneckRecurrence = analyzeBottleneckRecurrence(input.orders);
  const approvalLatency = analyzeApprovalLatency(input.approvals);
  const clientLifecycle = buildClientLifecycleInsights(input.orders, outcomes);
  const successScores = scoreFulfillmentSuccess(input.orders, outcomes);

  return {
    ordersAnalyzed: input.orders.length,
    outcomes,
    recommendationSignals,
    operatorPatterns,
    bottleneckRecurrence,
    approvalLatency,
    clientLifecycle,
    successScores,
    recommendationWeights,
    learnedAt: new Date().toISOString(),
  };
}

export function summarizeMemoryHighlights(store: OperationalMemoryStoreSnapshot): {
  websiteLowRevisionDrafts: number;
  trustStalledPackets: number;
  revenueOsLaunchBlocked: number;
  revenueOsCampaignStalled: number;
  clientsNeedingGuidance: number;
  fastestApprovalFlow: string | null;
  topEffectiveRecommendation: string | null;
  recurringBottleneck: string | null;
  topOwnerPriority: string | null;
} {
  const websiteLowRevisionDrafts = store.outcomes.filter(
    (o) => o.outcome === "website_draft_low_revision"
  ).length;
  const trustStalledPackets = store.outcomes.filter((o) => o.outcome === "trust_packet_stalled").length;
  const revenueOsLaunchBlocked = store.outcomes.filter(
    (o) => o.outcome === "revenue_os_launch_blocked"
  ).length;
  const revenueOsCampaignStalled = store.outcomes.filter(
    (o) => o.outcome === "revenue_os_campaign_stalled"
  ).length;
  const clientsNeedingGuidance = store.clientLifecycle.filter((c) => c.guidanceScore >= 55).length;

  const fastest = [...store.approvalLatency]
    .filter((a) => a.medianHoursToExecute != null)
    .sort((a, b) => (a.medianHoursToExecute ?? 999) - (b.medianHoursToExecute ?? 999))[0];

  const topRec = store.recommendationSignals[0];
  const topBottleneck = store.bottleneckRecurrence[0];
  const topOwner = store.operatorPatterns[0];

  return {
    websiteLowRevisionDrafts,
    trustStalledPackets,
    revenueOsLaunchBlocked,
    revenueOsCampaignStalled,
    clientsNeedingGuidance,
    fastestApprovalFlow: fastest
      ? `${fastest.proposedAction} (~${fastest.medianHoursToExecute}h median)`
      : null,
    topEffectiveRecommendation: topRec ? `${topRec.kind} (${topRec.effectivenessScore})` : null,
    recurringBottleneck: topBottleneck?.summary ?? null,
    topOwnerPriority: topOwner?.label ?? null,
  };
}

export function computeRevisionAnalytics(orders: OperationalMemoryBuildInput["orders"]): {
  websiteAvgDraftVersion: number;
  websiteRevisionRequestedRate: number;
  trustOwnerReviewPendingRate: number;
  revenueOsAvgRevisionRound: number;
  revenueOsLaunchBlockedRate: number;
} {
  const web = orders.filter((o) => o.department === FULFILLMENT_PRIMARY_SERVICE_WEBSITE);
  const trust = orders.filter((o) => o.department === FULFILLMENT_PRIMARY_SERVICE_TRUST);
  const revenue = orders.filter((o) => o.department === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS);
  const webVersions = web.map((o) => o.draftVersion);
  const websiteAvgDraftVersion = webVersions.length
    ? Math.round((webVersions.reduce((s, v) => s + v, 0) / webVersions.length) * 10) / 10
    : 0;
  const websiteRevisionRequestedRate = web.length
    ? web.filter((o) => o.clientDeliveryStatus === "client_revision_requested").length / web.length
    : 0;
  const trustOwnerReviewPendingRate = trust.length
    ? trust.filter((o) => o.pipelineStage === "owner_review" && o.ownerReviewStatus === "pending").length /
      trust.length
    : 0;

  const revenueRevisionRounds = revenue.map((o) => Math.max(0, o.draftVersion - 1));
  const revenueOsAvgRevisionRound = revenueRevisionRounds.length
    ? Math.round((revenueRevisionRounds.reduce((s, v) => s + v, 0) / revenueRevisionRounds.length) * 10) / 10
    : 0;
  const revenueOsLaunchBlockedRate = revenue.length
    ? revenue.filter((o) => o.approvalStatus === "pending").length / revenue.length
    : 0;

  return {
    websiteAvgDraftVersion,
    websiteRevisionRequestedRate: Math.round(websiteRevisionRequestedRate * 100) / 100,
    trustOwnerReviewPendingRate: Math.round(trustOwnerReviewPendingRate * 100) / 100,
    revenueOsAvgRevisionRound,
    revenueOsLaunchBlockedRate: Math.round(revenueOsLaunchBlockedRate * 100) / 100,
  };
}
