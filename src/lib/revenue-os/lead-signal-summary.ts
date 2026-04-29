/**
 * Aggregates bentley_lead_signals for sweep, notes, and decisioning.
 */

import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bentleyLeadSignals } from "@/lib/db/schema";
import type { ExtractedLeadSignal, LeadSignalClass } from "@/lib/revenue-os/lead-signal-extractor";

export type LeadSignalSummary = {
  totalSignals: number;
  highIntentSignals: number;
  urgentSignals: number;
  trustSeekingSignals: number;
  objectionClusters: string[];
  handoffReadyLeads: number;
  topTopics: string[];
  bestPerformingAnglesByIntent: Array<{ intent: string; angle: string; weight: number }>;
  dominantObjectionTopic: string | null;
  degraded: boolean;
};

export type LeadSignalBias = {
  totalSignals: number;
  objectionClusterCount: number;
  highIntentCount: number;
  handoffReadyCount: number;
  trustSeekingCount: number;
  dominantObjectionTopic: string | null;
};

const EMPTY_SUMMARY: LeadSignalSummary = {
  totalSignals: 0,
  highIntentSignals: 0,
  urgentSignals: 0,
  trustSeekingSignals: 0,
  objectionClusters: [],
  handoffReadyLeads: 0,
  topTopics: [],
  bestPerformingAnglesByIntent: [],
  dominantObjectionTopic: null,
  degraded: true,
};

const LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function summarizeExtractedLeadSignals(signals: ExtractedLeadSignal[]): LeadSignalSummary {
  if (!signals.length) {
    return { ...EMPTY_SUMMARY, degraded: true };
  }

  let highIntent = 0;
  let urgent = 0;
  let handoff = 0;
  let trustSeek = 0;
  const objections: string[] = [];
  const topicCount = new Map<string, number>();
  const angleByIntent = new Map<string, { angle: string; w: number }>();

  for (const s of signals) {
    if (s.commercialIntentScore >= 0.65) highIntent += 1;
    if (s.urgencyScore >= 0.65) urgent += 1;
    if (s.handoffReadiness >= 0.62) handoff += 1;
    if (s.signalClass === "trust_seeking") trustSeek += 1;
    if (s.signalClass === "objection" && s.topic) objections.push(s.topic);
    if (s.topic?.trim()) {
      const k = s.topic.trim().toLowerCase().slice(0, 120);
      topicCount.set(k, (topicCount.get(k) ?? 0) + 1);
    }
    const intent = s.signalClass;
    const w = s.commercialIntentScore * 0.5 + s.handoffReadiness * 0.5;
    const cur = angleByIntent.get(intent);
    const angleText = (s.angle?.trim() || s.extractedText).slice(0, 200);
    if (!cur || w > cur.w) angleByIntent.set(intent, { angle: angleText, w });
  }

  const topTopics = [...topicCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t]) => t);

  const objectionClusters = [...new Set(objections.map((o) => o.slice(0, 80)))].slice(0, 6);
  const dominantObjectionTopic = objectionClusters[0] ?? null;

  const bestPerformingAnglesByIntent = [...angleByIntent.entries()]
    .map(([intent, v]) => ({
      intent,
      angle: v.angle,
      weight: clamp01(v.w),
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8);

  return {
    totalSignals: signals.length,
    highIntentSignals: highIntent,
    urgentSignals: urgent,
    trustSeekingSignals: trustSeek,
    objectionClusters,
    handoffReadyLeads: handoff,
    topTopics,
    bestPerformingAnglesByIntent,
    dominantObjectionTopic,
    degraded: signals.length < 2,
  };
}

export function leadSummaryToBias(summary: LeadSignalSummary): LeadSignalBias {
  return {
    totalSignals: summary.totalSignals,
    objectionClusterCount: summary.objectionClusters.length,
    highIntentCount: summary.highIntentSignals,
    handoffReadyCount: summary.handoffReadyLeads,
    trustSeekingCount: summary.trustSeekingSignals,
    dominantObjectionTopic: summary.dominantObjectionTopic,
  };
}

export type GetLeadSignalSummaryParams = {
  userId: string | null | undefined;
  clientId: string;
  trustId: string;
  lookbackMs?: number;
};

/**
 * Loads recent persisted lead signals for a workspace. Returns degraded empty summary when unauthenticated or on error.
 */
export async function getLeadSignalSummary(params: GetLeadSignalSummaryParams): Promise<LeadSignalSummary> {
  const uid = params.userId != null && String(params.userId).trim() !== "" ? String(params.userId).trim() : null;
  if (!uid) {
    return { ...EMPTY_SUMMARY };
  }

  try {
    const db = await getDb();
    const since = new Date(Date.now() - (params.lookbackMs ?? LOOKBACK_MS));
    const rows = await db
      .select({
        topic: bentleyLeadSignals.topic,
        angle: bentleyLeadSignals.angle,
        signalClass: bentleyLeadSignals.signalClass,
        commercialIntentScore: bentleyLeadSignals.commercialIntentScore,
        urgencyScore: bentleyLeadSignals.urgencyScore,
        handoffReadiness: bentleyLeadSignals.handoffReadiness,
        extractedText: bentleyLeadSignals.extractedText,
      })
      .from(bentleyLeadSignals)
      .where(
        and(
          eq(bentleyLeadSignals.userId, uid),
          eq(bentleyLeadSignals.clientId, params.clientId ?? ""),
          eq(bentleyLeadSignals.trustId, params.trustId ?? ""),
          gte(bentleyLeadSignals.createdAt, since)
        )
      )
      .orderBy(desc(bentleyLeadSignals.createdAt))
      .limit(800);

    if (!rows.length) {
      return { ...EMPTY_SUMMARY };
    }

    const synthetic: ExtractedLeadSignal[] = rows.map((r) => {
      const cls = (r.signalClass ?? "unknown") as LeadSignalClass;
      const c = r.commercialIntentScore != null ? Number(r.commercialIntentScore) : 0.5;
      const u = r.urgencyScore != null ? Number(r.urgencyScore) : 0.45;
      const h = r.handoffReadiness != null ? Number(r.handoffReadiness) : 0.5;
      return {
        sourcePlatform: "stored",
        sourceType: "stored",
        sourceRef: null,
        topic: r.topic,
        hookType: null,
        angle: r.angle,
        sentimentScore: 0.5,
        commercialIntentScore: clamp01(c),
        urgencyScore: clamp01(u),
        handoffReadiness: clamp01(h),
        extractedText: String(r.extractedText ?? "").slice(0, 4000),
        extractedEntitiesJson: null,
        recommendedFollowup: "",
        signalClass: cls === "unknown" ? "mixed" : cls,
        experimentId: null,
        experimentVariantId: null,
      };
    });

    return summarizeExtractedLeadSignals(synthetic);
  } catch (e) {
    console.warn("[lead-signal-summary] query failed", e);
    return { ...EMPTY_SUMMARY };
  }
}
