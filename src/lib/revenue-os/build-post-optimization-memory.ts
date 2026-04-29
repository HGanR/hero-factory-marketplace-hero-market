/**
 * Derive conservative optimization memory from deployment feedback + post copy (no fabricated causality).
 */

import { createHash } from "crypto";
import type { NormalizedDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-contract";
import { feedbackRowKind, rowsForMetricAggregation } from "@/lib/revenue-os/deployment-feedback-summary";
import type {
  RevenueOsOptimizationEvidence,
  RevenueOsOptimizationMemoryEntry,
  RevenueOsOptimizationMemorySource,
  RevenueOsOptimizationMemorySummary,
  RevenueOsOptimizationOutcomeKind,
  RevenueOsMemoryEvidenceQuality,
} from "@/lib/revenue-os/post-optimization-memory-types";
import {
  buildMeasuredPlatformRoleHint,
  comparableAttentionEngagementFromEvidence,
  finalizeComparableSummaryFromPerPlatformStrengths,
} from "@/lib/revenue-os/cross-platform-performance-normalization";
import {
  evaluateInstagramMeasuredPreference,
} from "@/lib/revenue-os/instagram-measured-preference";
import {
  buildDefaultMetricSyncContext,
  evidenceVolumeDampening,
  getPlatformEvidenceWeight,
  inferMemoryEntryEvidenceInference,
  type EvidenceQuality,
  type MetricSyncContextLike,
} from "@/lib/revenue-os/platform-evidence-weighting";

export type CampaignPostLite = {
  id: string;
  campaignId: string;
  platform: string;
  caption: string | null;
  linkUrl: string | null;
  utmParams: Record<string, string> | null;
};

export type BuildOptimizationMemoryFromFeedbackArgs = {
  userId: string;
  feedbackRows: NormalizedDeploymentFeedback[];
  postsById: Record<string, CampaignPostLite>;
  /** Default when utm/source cannot be inferred */
  defaultSource?: RevenueOsOptimizationMemorySource;
};

export type SummarizeOptimizationMemoryOptions = {
  metricSyncContext?: MetricSyncContextLike | null;
};

/** Attach evidenceQuality + confidence for weighting (safe to call on DB-hydrated rows). */
export function enrichOptimizationMemoryEntries(
  entries: RevenueOsOptimizationMemoryEntry[],
  metricSyncContext?: MetricSyncContextLike | null
): RevenueOsOptimizationMemoryEntry[] {
  const ctx = metricSyncContext ?? buildDefaultMetricSyncContext();
  return entries.map((e) => {
    const inf = inferMemoryEntryEvidenceInference(e.platform, e.evidence, ctx);
    return {
      ...e,
      evidenceQuality: inf.evidenceQuality as RevenueOsMemoryEvidenceQuality,
      confidence: inf.confidence,
    };
  });
}

function weightedPatternScore(e: RevenueOsOptimizationMemoryEntry, ctx: MetricSyncContextLike): number {
  const ev = e.evidence;
  const base =
    (ev.leads ?? 0) * 50 +
    (ev.clicks ?? 0) * 3 +
    (ev.engagement ?? 0) * 1.2 +
    (ev.impressions ?? 0) * 0.01 -
    (ev.failures ?? 0) * 8 +
    (ev.publishCount ?? 0) * 2;
  const w = getPlatformEvidenceWeight(e.platform, ctx);
  const vol = evidenceVolumeDampening(ev);
  const measuredBoost = e.evidenceQuality === "live_metrics" ? 1.12 : 1;
  return base * w * vol * measuredBoost;
}

function weightedWeakScore(e: RevenueOsOptimizationMemoryEntry, ctx: MetricSyncContextLike): number {
  const fails = e.evidence.failures ?? 0;
  const w = Math.max(0.12, getPlatformEvidenceWeight(e.platform, ctx));
  return fails * w * evidenceVolumeDampening(e.evidence);
}

type BucketAgg = {
  platform: string;
  hookNorm: string;
  hookDisplay: string | null;
  angle: string | null;
  cta: string | null;
  source: RevenueOsOptimizationMemorySource;
  evidence: RevenueOsOptimizationEvidence;
};

function norm(s: string | null | undefined, max = 96): string {
  const t = (s ?? "").trim().replace(/\s+/g, " ");
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function computeOptimizationPatternKey(parts: {
  platform: string;
  hookNorm: string;
  angleNorm: string;
  ctaNorm: string;
}): string {
  const raw = [parts.platform.toLowerCase(), parts.hookNorm, parts.angleNorm, parts.ctaNorm].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

function inferSourceFromUtm(utm: Record<string, string> | null | undefined): RevenueOsOptimizationMemorySource {
  const src = (utm?.utm_source ?? "").toLowerCase();
  const med = (utm?.utm_medium ?? "").toLowerCase();
  if (src.includes("content_engine") || med.includes("content_engine")) return "content_engine";
  if (src.includes("launch") || med.includes("launch")) return "launch_mode";
  if (src.includes("notes") || src.includes("campaign_notes")) return "campaign_from_notes";
  return "manual";
}

function extractHookLine(caption: string | null | undefined): string | null {
  if (!caption?.trim()) return null;
  const line = caption.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  if (!line) return null;
  const stripped = line.replace(/#[\w]+/g, "").trim();
  return stripped.length ? norm(stripped, 120) : null;
}

function extractAngleFromUtm(utm: Record<string, string> | null | undefined): string | null {
  const c = utm?.utm_campaign ?? utm?.utm_content ?? "";
  return c.trim() ? norm(c, 120) : null;
}

function extractCtaHint(post: CampaignPostLite | undefined): string | null {
  if (!post) return null;
  if (post.linkUrl?.trim()) return norm(`link:${post.linkUrl.split("?")[0]?.slice(-40) ?? "present"}`, 80);
  return null;
}

/**
 * Classify a bucket from aggregated evidence only (conservative).
 */
export function classifyOptimizationOutcome(evidence: RevenueOsOptimizationEvidence): RevenueOsOptimizationOutcomeKind {
  const pub = evidence.publishCount ?? 0;
  const fail = evidence.failures ?? 0;
  const imp = evidence.impressions ?? 0;
  const clk = evidence.clicks ?? 0;
  const eng = evidence.engagement ?? 0;
  const leads = evidence.leads ?? 0;
  const total = pub + fail;

  if (total < 3) return "insufficient_data";

  const failRate = total > 0 ? fail / total : 0;
  if (fail >= 2 && failRate >= 0.35) return "negative";

  if (pub < 2) return "insufficient_data";

  const hasStrongMetric = leads > 0 || clk >= 8 || eng >= 25 || imp >= 2500;
  const hasLightMetric = imp >= 200 || clk >= 1 || eng >= 3;

  if (hasStrongMetric && failRate < 0.25) return "positive";
  if (hasLightMetric && failRate < 0.2 && pub >= 3) return "mixed";
  if (!hasLightMetric && failRate < 0.15 && pub >= 3) return "mixed";

  return "insufficient_data";
}

export function formatMemoryEntrySummary(
  platform: string,
  evidence: RevenueOsOptimizationEvidence,
  hook: string | null
): { outcomeKind: RevenueOsOptimizationOutcomeKind; summary: string } {
  const outcomeKind = classifyOptimizationOutcome(evidence);
  return { outcomeKind, summary: buildSummaryLine(platform, outcomeKind, evidence, hook) };
}

function buildSummaryLine(
  platform: string,
  outcome: RevenueOsOptimizationOutcomeKind,
  ev: RevenueOsOptimizationEvidence,
  hook: string | null
): string {
  const bits: string[] = [];
  if (ev.publishCount != null) bits.push(`${ev.publishCount} publish(es)`);
  if (ev.failures != null && ev.failures > 0) bits.push(`${ev.failures} fail(s)`);
  if (ev.impressions != null) bits.push(`~${ev.impressions} impr.`);
  if (ev.clicks != null) bits.push(`${ev.clicks} clicks`);
  if (ev.leads != null) bits.push(`${ev.leads} leads`);
  const hookBit = hook ? ` Hook sample: "${hook.slice(0, 72)}${hook.length > 72 ? "…" : ""}".` : "";
  return (
    `[${platform}] ${outcome.replace(/_/g, " ")} — ${bits.join(", ")}.${hookBit} Correlation not proven; use as a weak prior only.`
  );
}

/**
 * Group feedback + posts into memory entries (bounded, conservative).
 */
export function buildOptimizationMemoryFromFeedback(
  args: BuildOptimizationMemoryFromFeedbackArgs
): RevenueOsOptimizationMemoryEntry[] {
  const defaultSource = args.defaultSource ?? "manual";
  const { feedbackRows, postsById, userId } = args;

  const outcomeByPost = new Map<
    string,
    {
      hasPublished: boolean;
      failCount: number;
      platform: string;
      lastSource: NormalizedDeploymentFeedback["source"];
    }
  >();
  for (const r of feedbackRows) {
    if (feedbackRowKind(r) !== "publish_outcome") continue;
    const cur = outcomeByPost.get(r.campaignPostId) ?? {
      hasPublished: false,
      failCount: 0,
      platform: r.platform,
      lastSource: r.source,
    };
    if (r.publishStatus === "published") cur.hasPublished = true;
    if (r.publishStatus === "failed") cur.failCount += 1;
    cur.platform = r.platform;
    cur.lastSource = r.source;
    outcomeByPost.set(r.campaignPostId, cur);
  }

  const metricByPost = new Map<string, NormalizedDeploymentFeedback>();
  for (const m of rowsForMetricAggregation(feedbackRows)) {
    metricByPost.set(m.campaignPostId, m);
  }

  const buckets = new Map<string, BucketAgg>();

  for (const [postId, oc] of outcomeByPost) {
    if (!oc.hasPublished) continue;
    const post = postsById[postId];
    const plat = (post?.platform ?? oc.platform).toLowerCase();
    const hookDisplay = extractHookLine(post?.caption ?? null);
    const hookNorm = hookDisplay ? hookDisplay.toLowerCase().slice(0, 80) : "__aggregate__";
    const angle = extractAngleFromUtm(post?.utmParams ?? null);
    const cta = extractCtaHint(post);
    const utmSource = inferSourceFromUtm(post?.utmParams ?? null);
    const src: RevenueOsOptimizationMemorySource =
      utmSource !== "manual" ? utmSource : oc.lastSource === "manual_publish" ? "manual" : defaultSource;

    const m = metricByPost.get(postId);
    const key = `${plat}::${hookNorm}`;

    const prev = buckets.get(key);
    const ev: RevenueOsOptimizationEvidence = {
      publishCount: (prev?.evidence.publishCount ?? 0) + 1,
      failures: (prev?.evidence.failures ?? 0) + oc.failCount,
      impressions: (prev?.evidence.impressions ?? 0) + (m?.impressions ?? 0),
      clicks: (prev?.evidence.clicks ?? 0) + (m?.clicks ?? 0),
      engagement: (prev?.evidence.engagement ?? 0) + (m?.engagement ?? 0),
      leads: (prev?.evidence.leads ?? 0) + (m?.leads ?? 0),
    };

    buckets.set(key, {
      platform: plat,
      hookNorm,
      hookDisplay: hookNorm === "__aggregate__" ? null : hookDisplay,
      angle,
      cta,
      source: src,
      evidence: ev,
    });
  }

  const entries: RevenueOsOptimizationMemoryEntry[] = [];
  for (const b of buckets.values()) {
    const outcome = classifyOptimizationOutcome(b.evidence);
    const patternKey = computeOptimizationPatternKey({
      platform: b.platform,
      hookNorm: b.hookNorm,
      angleNorm: (b.angle ?? "").toLowerCase().slice(0, 80),
      ctaNorm: (b.cta ?? "").toLowerCase().slice(0, 80),
    });
    entries.push({
      userId,
      clientId: null,
      trustId: null,
      platform: b.platform,
      contentType: null,
      hook: b.hookDisplay,
      angle: b.angle,
      cta: b.cta,
      source: b.source,
      outcomeKind: outcome,
      evidence: b.evidence,
      summary: buildSummaryLine(b.platform, outcome, b.evidence, b.hookDisplay),
      patternKey,
    });
  }

  entries.sort((a, b) => (b.evidence.publishCount ?? 0) - (a.evidence.publishCount ?? 0));
  return entries.slice(0, 24);
}

export function summarizeOptimizationMemory(
  entries: RevenueOsOptimizationMemoryEntry[],
  opts?: SummarizeOptimizationMemoryOptions
): RevenueOsOptimizationMemorySummary {
  const ctx = opts?.metricSyncContext ?? buildDefaultMetricSyncContext();
  const enriched =
    entries.length > 0 && entries.some((e) => e.evidenceQuality == null)
      ? enrichOptimizationMemoryEntries(entries, ctx)
      : entries;

  const positive = enriched.filter((e) => e.outcomeKind === "positive");
  const negative = enriched.filter((e) => e.outcomeKind === "negative");
  const mixed = enriched.filter((e) => e.outcomeKind === "mixed");
  const insufficient = enriched.filter((e) => e.outcomeKind === "insufficient_data");

  const strongestPatterns = [...positive, ...mixed]
    .sort((a, b) => weightedPatternScore(b, ctx) - weightedPatternScore(a, ctx))
    .slice(0, 5);
  const weakestPatterns = [...negative, ...mixed]
    .sort((a, b) => weightedWeakScore(b, ctx) - weightedWeakScore(a, ctx))
    .slice(0, 5);

  const platformPreferences: Record<string, string[]> = {};
  for (const e of strongestPatterns) {
    const p = (e.platform ?? "unknown").toLowerCase();
    if (!platformPreferences[p]) platformPreferences[p] = [];
    const line = e.hook ? `Repeat hook shape: ${e.hook.slice(0, 60)}` : "Platform aggregate signal";
    if (platformPreferences[p].length < 3 && !platformPreferences[p].includes(line)) {
      platformPreferences[p].push(line);
    }
  }

  const informative = enriched.filter((e) => e.outcomeKind !== "insufficient_data");
  const hasEnoughData = informative.length >= 2 || positive.length + negative.length >= 1;

  const measuredCandidates = informative.filter((e) => e.evidenceQuality === "live_metrics");
  const operationalCandidates = informative.filter((e) => e.evidenceQuality === "publish_only");

  const measuredStrongestPlatform =
    measuredCandidates.sort((a, b) => weightedPatternScore(b, ctx) - weightedPatternScore(a, ctx))[0]?.platform ?? null;
  const operationalStrongestPlatform =
    operationalCandidates.sort((a, b) => weightedPatternScore(b, ctx) - weightedPatternScore(a, ctx))[0]?.platform ?? null;

  const memPer: Record<
    string,
    { attentionStrength: number; engagementStrength: number; metricClasses: string[] }
  > = {};
  for (const e of measuredCandidates) {
    const p = (e.platform ?? "unknown").toLowerCase();
    const eq = (e.evidenceQuality ?? "unknown") as EvidenceQuality;
    const d = evidenceVolumeDampening(e.evidence);
    const { attention, engagement } = comparableAttentionEngagementFromEvidence({
      evidence: e.evidence,
      platform: e.platform ?? "",
      evidenceQuality: eq,
      ctx,
      volumeMultiplier: d,
    });
    if (!memPer[p]) {
      memPer[p] = { attentionStrength: 0, engagementStrength: 0, metricClasses: [] };
    }
    memPer[p].attentionStrength += attention;
    memPer[p].engagementStrength += engagement;
  }
  const memComparable = finalizeComparableSummaryFromPerPlatformStrengths(memPer);
  const measuredStrongestAttentionPlatform = memComparable.bestAttentionPlatform ?? null;
  const measuredStrongestEngagementPlatform = memComparable.bestEngagementPlatform ?? null;
  const crossPlatformComparisonConfidence = memComparable.comparisonConfidence;
  const measuredPlatformRoleHint = buildMeasuredPlatformRoleHint({
    bestAttentionPlatform: measuredStrongestAttentionPlatform,
    bestEngagementPlatform: measuredStrongestEngagementPlatform,
    comparisonConfidence: crossPlatformComparisonConfidence,
  });

  let recommendationEvidenceBasis: RevenueOsOptimizationMemorySummary["recommendationEvidenceBasis"] = "insufficient";
  if (measuredCandidates.length && operationalCandidates.length) recommendationEvidenceBasis = "mixed";
  else if (measuredCandidates.length) recommendationEvidenceBasis = "live_metrics";
  else if (operationalCandidates.length) recommendationEvidenceBasis = "publish_only";

  const highLive = measuredCandidates.filter((e) => e.confidence === "high").length;
  const medLive = measuredCandidates.filter((e) => e.confidence === "medium").length;
  let summaryConfidence: "high" | "medium" | "low" = "low";
  if (highLive >= 2 || (highLive >= 1 && medLive >= 1)) summaryConfidence = "high";
  else if (highLive >= 1 || medLive >= 2 || informative.filter((e) => e.confidence === "medium").length >= 3) {
    summaryConfidence = "medium";
  }

  const capPlat = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  let nextGenerationRecommendation =
    "Keep publishing; memory will sharpen after a few more outcomes and optional metric sync.";
  if (
    memComparable.bestAttentionPlatform &&
    memComparable.bestEngagementPlatform &&
    memComparable.bestAttentionPlatform !== memComparable.bestEngagementPlatform
  ) {
    nextGenerationRecommendation = `Directional: **${capPlat(memComparable.bestAttentionPlatform)}** leads on **attention** in measured memory; **${capPlat(memComparable.bestEngagementPlatform)}** leads on **engagement-style** signals — different metric classes. Favor attention-style hooks on the first and comment-native angles on the second; still ship one experimental variant per batch.`;
  } else if (measuredStrongestPlatform) {
    nextGenerationRecommendation = `Measured signals favor **${measuredStrongestPlatform}** (composite memory score) — bias new hooks toward what worked there; still ship one experimental variant per batch.`;
  } else if (operationalStrongestPlatform && informative.length) {
    nextGenerationRecommendation = `**${operationalStrongestPlatform}** is the most reliable publish channel in your data, but measured metrics are thin — treat this as operational, not proof of creative dominance; enable metric sync where available.`;
  } else if (strongestPatterns[0]?.platform) {
    const sp = strongestPatterns[0];
    nextGenerationRecommendation = `Lean slightly toward **${sp.platform}** patterns that already published cleanly; still test one new hook per batch.`;
  }
  if (negative.length && (!strongestPatterns.length || (negative[0].evidence.failures ?? 0) >= 3)) {
    nextGenerationRecommendation = `Pause scaling **${negative[0].platform}** until OAuth/assets issues clear; recycle winners onto healthier channels.`;
  }
  if (!hasEnoughData || insufficient.length === enriched.length) {
    nextGenerationRecommendation = "Not enough stable history yet — avoid strong priors; keep volume modest and log outcomes.";
    recommendationEvidenceBasis = "insufficient";
    summaryConfidence = "low";
  }

  const summary: RevenueOsOptimizationMemorySummary = {
    strongestPatterns,
    weakestPatterns,
    platformPreferences,
    hasEnoughData,
    nextGenerationRecommendation,
    summaryConfidence,
    measuredStrongestPlatform,
    measuredStrongestAttentionPlatform,
    measuredStrongestEngagementPlatform,
    crossPlatformComparisonConfidence,
    measuredPlatformRoleHint,
    operationalStrongestPlatform,
    recommendationEvidenceBasis,
  };

  const igPref = evaluateInstagramMeasuredPreference(enriched, summary);
  if (igPref) {
    summary.instagramMeasuredPreference = igPref;
    summary.nextGenerationRecommendation = `${summary.nextGenerationRecommendation} Instagram is showing the strongest measured **attention** signal so far — lean slightly toward Instagram-style hooks/angles in the next batch while still including other platforms.`;
  }

  return summary;
}
