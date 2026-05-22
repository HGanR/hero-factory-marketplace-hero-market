import type {
  FulfillmentOutcomeRecord,
  RecommendationEffectivenessSignal,
  RecommendationMemoryWeights,
} from "@/lib/fulfillment/fulfillment-operational-memory-types";
import type {
  FulfillmentRecommendation,
  FulfillmentRecommendationKind,
} from "@/lib/fulfillment/fulfillment-orchestration-types";

const KINDS: FulfillmentRecommendationKind[] = [
  "engage_department",
  "sequence_next",
  "resolve_bottleneck",
  "cross_sell_advisory",
  "stall_recovery",
  "approval_review",
  "payment_gate",
  "monitor_only",
];

function outcomeBoostForKind(
  kind: FulfillmentRecommendationKind,
  outcomes: FulfillmentOutcomeRecord[]
): { score: number; insight: string } {
  const total = outcomes.length || 1;
  const approvalBlocked = outcomes.filter((o) => o.outcome === "approval_blocked").length / total;
  const stalled = outcomes.filter(
    (o) =>
      o.outcome === "trust_packet_stalled" ||
      o.outcome === "owner_review_stalled" ||
      o.outcome === "revenue_os_campaign_stalled"
  ).length / total;
  const revenueLaunchBlocked =
    outcomes.filter((o) => o.outcome === "revenue_os_launch_blocked").length / total;
  const revenueKpiWatch = outcomes.filter((o) => o.outcome === "revenue_os_kpi_watch").length / total;
  const lowRevision = outcomes.filter((o) => o.outcome === "website_draft_low_revision").length / total;
  const revisionHeavy = outcomes.filter((o) => o.outcome === "revision_heavy").length / total;

  switch (kind) {
    case "approval_review":
      return {
        score: 0.5 + approvalBlocked * 0.45 + revenueLaunchBlocked * 0.25,
        insight:
          approvalBlocked > 0.15 || revenueLaunchBlocked > 0.1
            ? "Approval review recommendations correlate with blocked orders — prioritize REVENUE_OS launch checkpoints when pending."
            : "Approval queue is light — use when new proposals land.",
      };
    case "stall_recovery":
      return {
        score: 0.4 + stalled * 0.5,
        insight:
          stalled > 0.2
            ? "Stall recovery is frequently relevant — owner attention reduces repeat stalls."
            : "Few active stalls — use for at-risk clients only.",
      };
    case "engage_department":
      return {
        score: 0.55 + lowRevision * 0.25,
        insight: "Engage-department actions align with forward drafting when handoff is complete.",
      };
    case "resolve_bottleneck":
      return {
        score: 0.5 + revisionHeavy * 0.2,
        insight: "Intake strengthening helps clients with revision-heavy WEBSITE cycles.",
      };
    case "payment_gate":
      return {
        score: 0.6 + approvalBlocked * 0.2,
        insight: "Payment gate recommendations prevent wasted drafting effort.",
      };
    case "sequence_next":
      return { score: 0.45, insight: "Sequencing is advisory — effective when TRUST and WEBSITE both active." };
    case "monitor_only":
      return {
        score: 0.35 + revenueKpiWatch * 0.25,
        insight: "Monitor-only — elevate when REVENUE_OS KPI watch signals appear.",
      };
    case "cross_sell_advisory":
      return { score: 0.3, insight: "Cross-sell advisories — human-only; never auto-order." };
    default:
      return { score: 0.5, insight: "General desk recommendation." };
  }
}

export function buildRecommendationEffectivenessSignals(
  outcomes: FulfillmentOutcomeRecord[]
): RecommendationEffectivenessSignal[] {
  return KINDS.map((kind) => {
    const { score, insight } = outcomeBoostForKind(kind, outcomes);
    return {
      kind,
      sampleCount: outcomes.length,
      effectivenessScore: Math.round(score * 100) / 100,
      insight,
    };
  }).sort((a, b) => b.effectivenessScore - a.effectivenessScore);
}

export function buildRecommendationMemoryWeights(
  signals: RecommendationEffectivenessSignal[]
): RecommendationMemoryWeights {
  const weights: RecommendationMemoryWeights = {};
  for (const s of signals) {
    weights[s.kind] = 0.85 + s.effectivenessScore * 0.3;
  }
  return weights;
}

const PRIORITY_RANK = { low: 0, normal: 1, high: 2 } as const;

export function applyMemoryWeightsToRecommendations(
  recommendations: FulfillmentRecommendation[],
  weights: RecommendationMemoryWeights | undefined
): FulfillmentRecommendation[] {
  if (!weights || !Object.keys(weights).length) return recommendations;

  return [...recommendations].sort((a, b) => {
    const wa = weights[a.kind] ?? 1;
    const wb = weights[b.kind] ?? 1;
    const pa = PRIORITY_RANK[a.priority] * wa;
    const pb = PRIORITY_RANK[b.priority] * wb;
    return pb - pa;
  });
}
