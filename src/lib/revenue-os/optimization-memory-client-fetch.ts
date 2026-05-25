/**
 * Browser fetch for optimization memory API (panel + Bentley).
 */

import type { RevenueOsOptimizationMemoryEntry, RevenueOsOptimizationMemorySummary, OptimizationMemoryGenerationSlice } from "@/lib/revenue-os/post-optimization-memory-types";

export type RevenueOsOptimizationMemoryApiResponse = {
  summary: RevenueOsOptimizationMemorySummary;
  entries: RevenueOsOptimizationMemoryEntry[];
  stats: { entryCount: number; latestUpdatedAt: string | null };
  generation: {
    hasEnoughData: boolean;
    promptWouldInject: boolean;
    injectedEntryIds: string[];
    promptWeightingSummary?: string;
    instagramPreferenceHint?: string | null;
    measuredPlatformRoleHint?: string | null;
    platformRoleRoutingHint?: string | null;
  };
  weightingDebug?: {
    platformWeights: Record<string, number>;
    live: string[];
    publishOnly: string[];
    entryConfidence: Array<{
      id?: string;
      platform?: string | null;
      evidenceQuality?: string;
      confidence?: string;
    }>;
    recommendationBasis?: string;
    promptWeightingSummary?: string;
    /** Present when includeWeightingDebug=1 */
    crossPlatformMemory?: {
      measuredStrongestAttentionPlatform: string | null;
      measuredStrongestEngagementPlatform: string | null;
      crossPlatformComparisonConfidence: string | null;
      primaryPreferenceBasis: string;
      measuredPlatformRoleHint: string | null;
      platformRoleRoutingHintInGeneration?: string | null;
    };
  };
};

/** Maps API `generation` (lightweight client DTO) to the full slice used by batch routing / unified prompts. */
export function apiGenerationToOptimizationMemorySlice(
  g: RevenueOsOptimizationMemoryApiResponse["generation"] | null | undefined
): OptimizationMemoryGenerationSlice | null {
  if (!g) return null;
  return {
    schemaVersion: 1,
    promptBlock: null,
    injectedEntryIds: Array.isArray(g.injectedEntryIds) ? g.injectedEntryIds.map((x) => String(x)) : [],
    hasEnoughData: Boolean(g.hasEnoughData),
    promptWeightingSummary: typeof g.promptWeightingSummary === "string" ? g.promptWeightingSummary : undefined,
    instagramPreferenceHint: g.instagramPreferenceHint ?? null,
    measuredPlatformRoleHint: g.measuredPlatformRoleHint ?? null,
    platformRoleRoutingHint: g.platformRoleRoutingHint ?? null,
    platformRoleRoutingSummary: null,
  };
}

export async function fetchRevenueOsOptimizationMemory(
  clientId: string | undefined,
  init?: RequestInit,
  opts?: { includeWeightingDebug?: boolean }
): Promise<RevenueOsOptimizationMemoryApiResponse | null> {
  const c = clientId?.trim() ?? "";
  const q = new URLSearchParams();
  if (c) q.set("clientId", c);
  if (opts?.includeWeightingDebug) q.set("includeWeightingDebug", "1");
  const qs = q.toString();
  const url = qs ? `/api/revenue-os/optimization-memory?${qs}` : "/api/revenue-os/optimization-memory";
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) return null;
  return (await res.json()) as RevenueOsOptimizationMemoryApiResponse;
}

export type PostOptimizationMemoryRefreshApiResponse = {
  ok: boolean;
  scannedPosts: number;
  memoryEntriesWritten: number;
  strongPatternsFound: number;
  weakPatternsFound: number;
  insufficientDataCount: number;
};

export async function postRevenueOsOptimizationMemoryRefresh(
  body?: { clientId?: string; feedbackLimit?: number }
): Promise<PostOptimizationMemoryRefreshApiResponse | null> {
  const res = await fetch("/api/revenue-os/post-optimization-memory/refresh", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) return null;
  return (await res.json()) as PostOptimizationMemoryRefreshApiResponse;
}
