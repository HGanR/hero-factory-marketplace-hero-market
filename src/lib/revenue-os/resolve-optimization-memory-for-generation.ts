/**
 * Compact optimization memory block for unified LLM prompts (omit when not useful).
 */

import type { OptimizationMemoryGenerationSlice } from "@/lib/revenue-os/post-optimization-memory-types";
import type { RevenueOsOptimizationMemoryEntry } from "@/lib/revenue-os/post-optimization-memory-types";
import {
  enrichOptimizationMemoryEntries,
  summarizeOptimizationMemory,
} from "@/lib/revenue-os/build-post-optimization-memory";
import { buildInstagramMeasuredPreferencePromptHint, evaluateInstagramMeasuredPreference } from "@/lib/revenue-os/instagram-measured-preference";
import { listOptimizationMemoryForUser } from "@/lib/revenue-os/post-optimization-memory-db";
import { buildDefaultMetricSyncContext, type MetricSyncContextLike } from "@/lib/revenue-os/platform-evidence-weighting";
import {
  buildPlatformRoleRoutingGenerationHint,
  derivePlatformRoleRouting,
  type RevenueOsPlatformRoleRoutingSummary,
} from "@/lib/revenue-os/platform-role-routing";

function shouldInjectMemory(entries: RevenueOsOptimizationMemoryEntry[]): boolean {
  if (entries.length === 0) return false;
  const informative = entries.filter((e) => e.outcomeKind !== "insufficient_data");
  if (informative.length >= 2) return true;
  if (informative.some((e) => e.outcomeKind === "positive" || e.outcomeKind === "negative")) return true;
  return entries.length >= 6;
}

export function buildOptimizationMemoryPromptBlock(
  entries: RevenueOsOptimizationMemoryEntry[],
  opts?: { metricSyncContext?: MetricSyncContextLike | null }
): {
  block: string | null;
  injectedEntryIds: string[];
  hasEnoughData: boolean;
  promptWeightingSummary: string;
  instagramPreferenceHint: string | null;
  measuredPlatformRoleHint: string | null;
  platformRoleRoutingHint: string | null;
  platformRoleRoutingSummary: RevenueOsPlatformRoleRoutingSummary;
} {
  const ctx = opts?.metricSyncContext ?? buildDefaultMetricSyncContext();
  const enriched =
    entries.length > 0 && entries.some((e) => e.evidenceQuality == null)
      ? enrichOptimizationMemoryEntries(entries, ctx)
      : entries;
  const summary = summarizeOptimizationMemory(enriched, { metricSyncContext: ctx });
  const igPref = evaluateInstagramMeasuredPreference(enriched, summary);

  const roleHint = summary.measuredPlatformRoleHint ?? null;
  const roleRouting = derivePlatformRoleRouting({
    deploymentRollup: null,
    memorySummary: summary,
    metricSyncContext: ctx,
    signalsInput: null,
    systemSignals: null,
  });
  const platformRoleRoutingHint = buildPlatformRoleRoutingGenerationHint(roleRouting);
  const promptWeightingSummary = [
    `basis=${summary.recommendationEvidenceBasis ?? "n/a"}`,
    `summaryConf=${summary.summaryConfidence ?? "n/a"}`,
    `measured=${summary.measuredStrongestPlatform ?? "n/a"}`,
    `attLeader=${summary.measuredStrongestAttentionPlatform ?? "n/a"}`,
    `engLeader=${summary.measuredStrongestEngagementPlatform ?? "n/a"}`,
    `operational=${summary.operationalStrongestPlatform ?? "n/a"}`,
    igPref ? "igMeasuredPref=on" : "igMeasuredPref=off",
    roleHint ? "roleHint=on" : "roleHint=off",
    platformRoleRoutingHint ? "platformRoleRouting=on" : "platformRoleRouting=off",
  ].join("; ");

  if (!shouldInjectMemory(enriched)) {
    return {
      block: null,
      injectedEntryIds: [],
      hasEnoughData: summary.hasEnoughData,
      promptWeightingSummary,
      instagramPreferenceHint: igPref ? buildInstagramMeasuredPreferencePromptHint() : null,
      measuredPlatformRoleHint: roleHint,
      platformRoleRoutingHint,
      platformRoleRoutingSummary: roleRouting,
    };
  }

  const injected = enriched
    .filter((e) => e.id && e.outcomeKind !== "insufficient_data")
    .slice(0, 8)
    .map((e) => e.id!);

  const strongestMeasured = enriched
    .filter((e) => e.evidenceQuality === "live_metrics" && e.outcomeKind !== "insufficient_data")
    .slice(0, 3);
  const strongestOther = enriched
    .filter((e) => e.evidenceQuality !== "live_metrics" && e.outcomeKind !== "insufficient_data")
    .slice(0, 2);

  const payload = {
    recommendation: summary.nextGenerationRecommendation,
    recommendationBasis: summary.recommendationEvidenceBasis,
    summaryConfidence: summary.summaryConfidence,
    measuredStrongestPlatform: summary.measuredStrongestPlatform,
    measuredStrongestAttentionPlatform: summary.measuredStrongestAttentionPlatform,
    measuredStrongestEngagementPlatform: summary.measuredStrongestEngagementPlatform,
    crossPlatformComparisonConfidence: summary.crossPlatformComparisonConfidence,
    operationalStrongestPlatform: summary.operationalStrongestPlatform,
    measuredPlatformPreferenceHint: igPref ? buildInstagramMeasuredPreferencePromptHint() : undefined,
    measuredPlatformRoleHint: roleHint ?? undefined,
    platformRoleRoutingHint: platformRoleRoutingHint ?? undefined,
    preferPlatforms: Object.keys(summary.platformPreferences).slice(0, 5),
    platformHints: summary.platformPreferences,
    strongestMeasured: strongestMeasured.map((e) => ({
      platform: e.platform,
      outcome: e.outcomeKind,
      confidence: e.confidence,
      summary: e.summary,
    })),
    strongestPublishOnly: strongestOther.map((e) => ({
      platform: e.platform,
      outcome: e.outcomeKind,
      confidence: e.confidence,
      summary: e.summary,
    })),
    weakest: summary.weakestPatterns.slice(0, 3).map((e) => ({
      platform: e.platform,
      outcome: e.outcomeKind,
      evidenceQuality: e.evidenceQuality,
      summary: e.summary,
    })),
  };

  const block = [
    "=== OPTIMIZATION MEMORY ===",
    JSON.stringify(payload, null, 2),
    "",
    "Instruction: Prefer **measured** (live_metrics) patterns when generating copy; treat publish-only rows as operational, not proof of creative dominance. Do not overcommit to low-confidence patterns. If `measuredPlatformRoleHint` or `platformRoleRoutingHint` is present, use for channel **jobs-to-be-done** (attention vs engagement/authority) — subordinate to USER INPUT and chosen posting platforms. If the JSON includes a measured-platform preference hint, treat it as a mild default only — never contradict USER INPUT or CAMPAIGN BRIEF.",
    `entryIds: ${injected.join(",") || "(none)"}`,
  ].join("\n");

  return {
    block,
    injectedEntryIds: injected,
    hasEnoughData: summary.hasEnoughData,
    promptWeightingSummary,
    instagramPreferenceHint: igPref ? buildInstagramMeasuredPreferencePromptHint() : null,
    measuredPlatformRoleHint: roleHint,
    platformRoleRoutingHint,
    platformRoleRoutingSummary: roleRouting,
  };
}

export async function resolveOptimizationMemoryForGeneration(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  args: { userId: number; clientId?: string }
): Promise<OptimizationMemoryGenerationSlice | null> {
  if (args.userId == null || Number.isNaN(args.userId)) return null;

  const entries = await listOptimizationMemoryForUser(db, String(args.userId), {
    clientId: args.clientId?.trim() || undefined,
    limit: 48,
  });

  const ctx = buildDefaultMetricSyncContext();
  const {
    block,
    injectedEntryIds,
    hasEnoughData,
    promptWeightingSummary,
    instagramPreferenceHint,
    measuredPlatformRoleHint,
    platformRoleRoutingHint,
    platformRoleRoutingSummary,
  } = buildOptimizationMemoryPromptBlock(entries, {
    metricSyncContext: ctx,
  });

  return {
    schemaVersion: 1,
    promptBlock: block,
    injectedEntryIds,
    hasEnoughData,
    promptWeightingSummary,
    instagramPreferenceHint,
    measuredPlatformRoleHint,
    platformRoleRoutingHint,
    platformRoleRoutingSummary,
  };
}
