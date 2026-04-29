/**
 * Cross-platform evidence quality for weighting memory, rollups, and generation (conservative, deterministic).
 */

import type { SocialPlatform } from "@/lib/social/config";
import { listAllPlatformPerformanceCapabilities } from "@/lib/social/platform-performance-adapter-capabilities";
import type { RevenueOsOptimizationEvidence } from "@/lib/revenue-os/post-optimization-memory-types";

export type EvidenceQuality = "live_metrics" | "publish_only" | "unsupported" | "unknown";

/** Canonical numeric weights (deterministic; conservative). */
export const EVIDENCE_WEIGHT: Record<EvidenceQuality, number> = {
  live_metrics: 1,
  publish_only: 0.48,
  unsupported: 0.2,
  unknown: 0.16,
};

/** API / generation — same shape as deployment-feedback `metricSyncContext`. */
export type MetricSyncContextLike = {
  liveMetricPlatforms: readonly string[];
  stubPublishPlatforms: readonly string[];
};

export function buildDefaultMetricSyncContext(): MetricSyncContextLike {
  const caps = listAllPlatformPerformanceCapabilities();
  return {
    liveMetricPlatforms: caps.filter((c) => c.metricSyncImplementation === "live").map((c) => c.platform),
    stubPublishPlatforms: caps
      .filter((c) => c.supportsPublish && c.metricSyncImplementation === "stub")
      .map((c) => c.platform),
  };
}

function normPlatform(p: string | null | undefined): string {
  return (p ?? "").trim().toLowerCase();
}

function inList(platform: string, list: readonly string[] | undefined): boolean {
  const n = normPlatform(platform);
  return list?.some((x) => normPlatform(x) === n) ?? false;
}

/**
 * Platform capability tier from metric sync context (and capability map fallback).
 */
export function getPlatformEvidenceQuality(
  platform: string | null | undefined,
  metricSyncContext: MetricSyncContextLike | null | undefined
): EvidenceQuality {
  const p = normPlatform(platform);
  if (!p) return "unknown";
  const ctx = metricSyncContext ?? buildDefaultMetricSyncContext();
  if (inList(p, ctx.liveMetricPlatforms)) return "live_metrics";
  if (inList(p, ctx.stubPublishPlatforms)) return "publish_only";
  const caps = listAllPlatformPerformanceCapabilities();
  const row = caps.find((c) => c.platform === (p as SocialPlatform));
  if (row?.metricSyncImplementation === "live") return "live_metrics";
  if (row?.supportsPublish && row.metricSyncImplementation === "stub") return "publish_only";
  if (row && !row.supportsPublish) return "unsupported";
  return "unknown";
}

export function getPlatformEvidenceWeight(
  platform: string | null | undefined,
  metricSyncContext: MetricSyncContextLike | null | undefined
): number {
  return EVIDENCE_WEIGHT[getPlatformEvidenceQuality(platform, metricSyncContext)];
}

/** Nonlinear dampening so tiny publish counts do not dominate (sqrt curve, cap 1). */
export function evidenceVolumeDampening(evidence: RevenueOsOptimizationEvidence): number {
  const pub = Math.max(0, evidence.publishCount ?? 0);
  return Math.min(1, Math.sqrt(pub) / Math.sqrt(5));
}

/** True when evidence includes non-trivial measured signals (aligned with memory classifier “light” bar). */
export function hasMeasuredSignalsInEvidence(evidence: RevenueOsOptimizationEvidence): boolean {
  const imp = evidence.impressions ?? 0;
  const clk = evidence.clicks ?? 0;
  const eng = evidence.engagement ?? 0;
  const leads = evidence.leads ?? 0;
  return leads > 0 || clk >= 1 || eng >= 3 || imp >= 200;
}

export type MemoryEntryEvidenceInference = {
  evidenceQuality: EvidenceQuality;
  confidence: "high" | "medium" | "low";
};

/**
 * Per memory row: combine platform tier with whether this bucket actually contains synced metrics.
 */
export function inferMemoryEntryEvidenceInference(
  platform: string | null | undefined,
  evidence: RevenueOsOptimizationEvidence,
  metricSyncContext: MetricSyncContextLike | null | undefined
): MemoryEntryEvidenceInference {
  const tier = getPlatformEvidenceQuality(platform, metricSyncContext);
  const measured = hasMeasuredSignalsInEvidence(evidence);
  const pub = evidence.publishCount ?? 0;

  let evidenceQuality: EvidenceQuality;
  if (tier === "live_metrics" && measured) evidenceQuality = "live_metrics";
  else if (tier === "live_metrics" && !measured) evidenceQuality = "publish_only";
  else evidenceQuality = tier;

  let confidence: "high" | "medium" | "low" = "low";
  if (evidenceQuality === "live_metrics") {
    if (pub >= 4 && measured) confidence = "high";
    else if (pub >= 2) confidence = "medium";
    else confidence = "low";
  } else if (evidenceQuality === "publish_only") {
    if (pub >= 5) confidence = "medium";
    else confidence = "low";
  } else {
    confidence = pub >= 4 ? "low" : "low";
  }

  return { evidenceQuality, confidence };
}

export function summarizePlatformEvidenceWeighting(metricSyncContext: MetricSyncContextLike | null | undefined): {
  live: string[];
  publishOnly: string[];
  weights: Record<string, number>;
} {
  const ctx = metricSyncContext ?? buildDefaultMetricSyncContext();
  const all = new Set<string>([
    ...ctx.liveMetricPlatforms.map(normPlatform),
    ...ctx.stubPublishPlatforms.map(normPlatform),
  ]);
  const weights: Record<string, number> = {};
  for (const p of all) {
    if (!p) continue;
    weights[p] = getPlatformEvidenceWeight(p, ctx);
  }
  return {
    live: [...ctx.liveMetricPlatforms],
    publishOnly: [...ctx.stubPublishPlatforms],
    weights,
  };
}
