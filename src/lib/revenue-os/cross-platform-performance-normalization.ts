/**
 * Cross-platform “performance” without equating unlike metrics (Instagram reach vs LinkedIn socialActions).
 * Used by deployment rollups, Bentley copy, and optimization memory — additive to existing scores.
 */

import type { DeploymentFeedbackRowKind } from "@/lib/revenue-os/deployment-feedback-contract";
import type { EvidenceQuality } from "@/lib/revenue-os/platform-evidence-weighting";
import {
  buildDefaultMetricSyncContext,
  getPlatformEvidenceWeight,
  type MetricSyncContextLike,
} from "@/lib/revenue-os/platform-evidence-weighting";

export type ComparableSignalKind = "attention" | "engagement" | "publish_success";

/** Non-negative comparable strength after tier + platform weighting (relative scale, not impressions). */
export type ComparableSignalStrength = number;

export type ComparableConfidence = "high" | "medium" | "low";

export type ComparablePerformanceSignal = {
  kind: ComparableSignalKind;
  strength: ComparableSignalStrength;
  confidence: ComparableConfidence;
};

export type NormalizeComparablePerformanceSignalArgs = {
  platform: string;
  impressions?: number | null;
  clicks?: number | null;
  engagement?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  leads?: number | null;
  evidenceQuality: EvidenceQuality;
  feedbackRowKind: DeploymentFeedbackRowKind;
};

function normPlatform(p: string): string {
  return p.trim().toLowerCase();
}

/** Engagement-style composite — never uses impressions (avoids LI comments vs IG reach false equivalence). */
export function engagementComparableRaw(args: {
  engagement?: number | null;
  clicks?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  leads?: number | null;
}): number {
  let s = 0;
  if (args.engagement != null) s += args.engagement;
  if (args.clicks != null) s += args.clicks * 2;
  if (args.comments != null) s += args.comments * 3;
  if (args.shares != null) s += args.shares * 4;
  if (args.saves != null) s += args.saves * 3;
  if (args.leads != null) s += args.leads * 20;
  return s;
}

function confidenceForLiveRow(hasSignal: boolean, strength: number): ComparableConfidence {
  if (!hasSignal || strength <= 0) return "low";
  if (strength < 8) return "low";
  if (strength < 35) return "medium";
  return "high";
}

/**
 * Per feedback/metrics row: which comparable signals exist and how strong they are.
 * Does not emit cross-platform performance conclusions for unsupported tiers or publish-only metric rows.
 */
export function normalizeComparablePerformanceSignal(
  args: NormalizeComparablePerformanceSignalArgs,
  metricSyncContext?: MetricSyncContextLike | null
): { signals: ComparablePerformanceSignal[]; notes: string[] } {
  const ctx = metricSyncContext ?? buildDefaultMetricSyncContext();
  const notes: string[] = [];
  const signals: ComparablePerformanceSignal[] = [];
  const w = getPlatformEvidenceWeight(args.platform, ctx);
  const q = args.evidenceQuality;

  if (q === "unsupported" || q === "unknown") {
    notes.push("unsupported_or_unknown_tier:no_performance_signal");
    return { signals, notes };
  }

  const hasMetricPayload =
    (args.impressions != null && args.impressions > 0) || engagementComparableRaw(args) > 0;

  if (args.feedbackRowKind !== "performance_metrics") {
    if (!hasMetricPayload || q !== "live_metrics") {
      notes.push("non_metric_row_or_unmeasured:no_comparable_signal");
      return { signals, notes };
    }
    notes.push("metric_payload_on_publish_outcome:comparable_signals_when_live_tier");
  } else if (q !== "live_metrics") {
    notes.push("publish_only_or_nonlive_metrics:no_measured_performance_signal");
    return { signals, notes };
  }

  const imp = args.impressions ?? 0;
  const engRaw = engagementComparableRaw(args);
  const hasImp = args.impressions != null && imp > 0;
  const hasEng = engRaw > 0;

  if (hasImp) {
    const strength = imp * w;
    signals.push({
      kind: "attention",
      strength,
      confidence: confidenceForLiveRow(true, strength),
    });
  } else {
    notes.push("no_impressions:no_attention_signal");
  }

  if (hasEng) {
    const strength = engRaw * w;
    signals.push({
      kind: "engagement",
      strength,
      confidence: confidenceForLiveRow(true, strength),
    });
  } else {
    notes.push("no_engagement_fields:no_engagement_signal");
  }

  return { signals, notes };
}

export type ComparablePlatformPerformanceSummary = {
  bestAttentionPlatform?: string;
  bestEngagementPlatform?: string;
  comparisonConfidence: ComparableConfidence;
  confidenceNotes: string[];
  safeNarrativeLines: string[];
  /** Platforms with any positive measured attention (impressions) in scope. */
  platformsWithAttentionData: string[];
  /** Platforms with any positive measured engagement-style signal. */
  platformsWithEngagementData: string[];
  /** Live-metrics platforms that contributed to either bucket (>1 enables cross-platform reads). */
  measuredLivePlatformsInComparison: string[];
  /** Whether the headline “winner” story should lean attention, engagement, both, or none. */
  primaryComparisonBasis: "attention" | "engagement" | "mixed" | "none";
  /** Debug / observability: per-platform strengths and declared metric classes. */
  perPlatform: Record<
    string,
    { attentionStrength: number; engagementStrength: number; metricClasses: string[] }
  >;
};

function mergePlatformMetricClasses(
  perPlatform: ComparablePlatformPerformanceSummary["perPlatform"],
  platform: string,
  cls: string
): void {
  const p = normPlatform(platform);
  if (!perPlatform[p]) {
    perPlatform[p] = { attentionStrength: 0, engagementStrength: 0, metricClasses: [] };
  }
  if (!perPlatform[p].metricClasses.includes(cls)) {
    perPlatform[p].metricClasses.push(cls);
  }
}

/**
 * Aggregate measured live-metrics rows only. Caller supplies deduped metric rows (e.g. rowsForMetricAggregation).
 */
export function summarizeComparablePlatformPerformance(args: {
  metricRows: Array<NormalizeComparablePerformanceSignalArgs & { platform: string; feedbackRowKind: DeploymentFeedbackRowKind }>;
  ctx: MetricSyncContextLike;
}): ComparablePlatformPerformanceSummary {
  const { metricRows, ctx } = args;
  const perPlatform: ComparablePlatformPerformanceSummary["perPlatform"] = {};

  for (const row of metricRows) {
    const { signals } = normalizeComparablePerformanceSignal(row, ctx);
    const p = normPlatform(row.platform);
    if (!perPlatform[p]) {
      perPlatform[p] = { attentionStrength: 0, engagementStrength: 0, metricClasses: [] };
    }
    for (const s of signals) {
      if (s.kind === "attention") {
        perPlatform[p].attentionStrength += s.strength;
        mergePlatformMetricClasses(perPlatform, p, "attention_impressions");
      }
      if (s.kind === "engagement") {
        perPlatform[p].engagementStrength += s.strength;
        mergePlatformMetricClasses(perPlatform, p, "engagement_actions");
      }
    }
  }

  return finalizeComparableSummaryFromPerPlatformStrengths(perPlatform);
}

/**
 * Shared finalization for deployment rollups and optimization-memory aggregates.
 */
export function finalizeComparableSummaryFromPerPlatformStrengths(
  perPlatformIn: ComparablePlatformPerformanceSummary["perPlatform"]
): ComparablePlatformPerformanceSummary {
  const perPlatform: ComparablePlatformPerformanceSummary["perPlatform"] = {};
  for (const [k, v] of Object.entries(perPlatformIn)) {
    const p = normPlatform(k);
    const classes = [...(v.metricClasses ?? [])];
    if (!classes.length) {
      if (v.attentionStrength > 0) classes.push("attention_impressions");
      if (v.engagementStrength > 0) classes.push("engagement_actions");
    }
    perPlatform[p] = {
      attentionStrength: v.attentionStrength,
      engagementStrength: v.engagementStrength,
      metricClasses: classes,
    };
  }

  const confidenceNotes: string[] = [];
  const safeNarrativeLines: string[] = [];

  const platformsWithAttentionData = Object.keys(perPlatform).filter((p) => perPlatform[p]!.attentionStrength > 0);
  const platformsWithEngagementData = Object.keys(perPlatform).filter((p) => perPlatform[p]!.engagementStrength > 0);
  const measuredLivePlatformsInComparison = [
    ...new Set([...platformsWithAttentionData, ...platformsWithEngagementData]),
  ].sort();

  const rankDesc = (get: (p: string) => number): string | undefined => {
    const keys = Object.keys(perPlatform).filter((p) => get(p) > 0);
    if (keys.length === 0) return undefined;
    keys.sort((a, b) => get(b) - get(a));
    return keys[0];
  };

  const bestAttentionPlatform = rankDesc((p) => perPlatform[p]!.attentionStrength);
  const bestEngagementPlatform = rankDesc((p) => perPlatform[p]!.engagementStrength);

  const hasAttLeader = Boolean(bestAttentionPlatform);
  const hasEngLeader = Boolean(bestEngagementPlatform);
  let primaryComparisonBasis: ComparablePlatformPerformanceSummary["primaryComparisonBasis"] = "none";
  if (hasAttLeader && hasEngLeader) primaryComparisonBasis = "mixed";
  else if (hasAttLeader) primaryComparisonBasis = "attention";
  else if (hasEngLeader) primaryComparisonBasis = "engagement";

  const multi = measuredLivePlatformsInComparison.length >= 2;
  const attentionParity = platformsWithAttentionData.length >= 2;
  const engagementOnlyMulti =
    multi && platformsWithEngagementData.length >= 2 && platformsWithAttentionData.length < 2;

  let comparisonConfidence: ComparableConfidence = "low";
  if (!multi) {
    comparisonConfidence = measuredLivePlatformsInComparison.length === 1 ? "medium" : "low";
    confidenceNotes.push("single_or_no_measured_platform:cross_platform_compare_limited");
  } else if (attentionParity && bestAttentionPlatform) {
    comparisonConfidence = "high";
    confidenceNotes.push("multiple_platforms_with_impressions:attention_compare_safer");
  } else if (engagementOnlyMulti) {
    comparisonConfidence = "low";
    confidenceNotes.push("engagement_only_across_platforms:directional_not_reach_parity");
  } else if (platformsWithAttentionData.length === 1 && multi) {
    comparisonConfidence = "medium";
    confidenceNotes.push("single_platform_has_impressions:do_not_equate_to_other_channel_reach");
  } else {
    comparisonConfidence = "medium";
  }

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  if (bestAttentionPlatform && multi && platformsWithAttentionData.length === 1) {
    safeNarrativeLines.push(
      `**${cap(bestAttentionPlatform)}** currently has the **strongest measured attention signal** (impressions/reach-style data) in this scope; other live channels here are **not** reporting comparable reach — do not read their engagement as “beating” impressions.`
    );
  } else if (bestAttentionPlatform && attentionParity) {
    safeNarrativeLines.push(
      `**${cap(bestAttentionPlatform)}** leads on **measured attention** (synced impressions) among channels that expose that field.`
    );
  }

  if (bestEngagementPlatform) {
    safeNarrativeLines.push(
      `**${cap(bestEngagementPlatform)}** is showing the **strongest measured engagement-style signal** from the metrics available (likes, comments, saves, clicks — not the same class as reach).`
    );
  }

  if (
    bestAttentionPlatform &&
    bestEngagementPlatform &&
    bestAttentionPlatform !== bestEngagementPlatform &&
    multi
  ) {
    safeNarrativeLines.push(
      "These are **different metric classes**, so treat this as **directional** rather than exact apples-to-apples performance."
    );
    confidenceNotes.push("split_attention_engagement_leaders:avoid_single_winner_language");
  }

  if (engagementOnlyMulti) {
    safeNarrativeLines.push(
      "Cross-channel comparison here is **engagement-shaped only** (no shared impression basis) — confidence stays **low** for declaring an overall “winner.”"
    );
  }

  if (primaryComparisonBasis === "none" && measuredLivePlatformsInComparison.length === 0) {
    confidenceNotes.push("no_live_metric_signals:no_measured_performance_story");
  }

  return {
    bestAttentionPlatform,
    bestEngagementPlatform,
    comparisonConfidence,
    confidenceNotes,
    safeNarrativeLines,
    platformsWithAttentionData,
    platformsWithEngagementData,
    measuredLivePlatformsInComparison,
    primaryComparisonBasis,
    perPlatform,
  };
}

/** Memory / evidence objects — same engagement rule as deployment rows. */
export function comparableAttentionEngagementFromEvidence(args: {
  evidence: {
    impressions?: number;
    clicks?: number;
    engagement?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    leads?: number;
  };
  platform: string;
  evidenceQuality: EvidenceQuality;
  ctx: MetricSyncContextLike;
  volumeMultiplier: number;
}): { attention: number; engagement: number } {
  const w = getPlatformEvidenceWeight(args.platform, args.ctx);
  const m = Math.max(0, args.volumeMultiplier);
  if (args.evidenceQuality !== "live_metrics") {
    return { attention: 0, engagement: 0 };
  }
  const imp = args.evidence.impressions ?? 0;
  const att = imp > 0 ? imp * w * m : 0;
  const engRaw = engagementComparableRaw(args.evidence);
  const eng = engRaw > 0 ? engRaw * w * m : 0;
  return { attention: att, engagement: eng };
}

function capitalizePlatform(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** One compact line for unified generation prompts when attention vs engagement leaders differ. */
export function buildMeasuredPlatformRoleHint(args: {
  bestAttentionPlatform?: string | null;
  bestEngagementPlatform?: string | null;
  comparisonConfidence?: ComparableConfidence | null;
}): string | null {
  const a = args.bestAttentionPlatform?.trim().toLowerCase();
  const e = args.bestEngagementPlatform?.trim().toLowerCase();
  if (!a && !e) return null;
  const conf = args.comparisonConfidence ?? "low";
  if (a && e && a !== e) {
    return (
      `Directional: ${capitalizePlatform(a)} preferred for attention-style hooks (impressions); ${capitalizePlatform(e)} for engagement/comment-native resonance — unlike metric classes; conf=${conf}.`
    );
  }
  if (a) {
    return `Attention-led measured lean: ${capitalizePlatform(a)} (reach-style impressions in memory); keep engagement claims separate where other channels lack comparable reach.`;
  }
  return `Engagement-led measured lean: ${capitalizePlatform(e!)} (action-style metrics only; not reach parity vs impression-led channels).`;
}
