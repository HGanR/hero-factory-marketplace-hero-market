/**
 * Aggregates content_feedback_log rows for Bentley market sweep + decision engine.
 * Degrades gracefully when there are no rows or sparse sentiment.
 */

import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { contentFeedbackLog } from "@/lib/db/schema";
import type { LeadSignalBias } from "@/lib/revenue-os/lead-signal-summary";

export type FeedbackAggregationResult = {
  feedbackCount: number;
  negativeSentimentRatio: number;
  positiveSentimentRatio: number;
  topPerformingTopics: string[];
  underperformingTopics: string[];
  topPerformingHookTypes: string[];
  /** True when there is no usable feedback signal (empty or auth skipped). */
  degraded: boolean;
  /** From recent A/B experiments (optional). */
  experimentBoostHookTypes?: string[];
  experimentSuppressAngles?: string[];
  experimentPromotionThemes?: string[];
  /** Optional workspace lead-intent aggregates for scoring + decisioning. */
  leadSignalBias?: LeadSignalBias | null;
};

const EMPTY: FeedbackAggregationResult = {
  feedbackCount: 0,
  negativeSentimentRatio: 0,
  positiveSentimentRatio: 0,
  topPerformingTopics: [],
  underperformingTopics: [],
  topPerformingHookTypes: [],
  degraded: true,
};

const LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function sentimentBucket(s: string | null | undefined): "positive" | "negative" | "neutral" | "unknown" {
  if (!s?.trim()) return "unknown";
  const x = s.toLowerCase();
  if (/^(pos|good|up|yes|win)/.test(x) || x === "positive") return "positive";
  if (/^(neg|bad|down|no|loss)/.test(x) || x === "negative") return "negative";
  if (x === "neutral" || x === "mixed") return "neutral";
  if (x.includes("positive")) return "positive";
  if (x.includes("negative")) return "negative";
  return "unknown";
}

function topicFromRow(row: {
  rawPayload: unknown;
  notes: string | null;
  platform: string | null;
}): string | null {
  const raw = row.rawPayload;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const t = o.topic ?? o.topicLabel ?? o.theme ?? o.angle;
    if (typeof t === "string" && t.trim()) return t.trim().slice(0, 120);
    const arr = o.topics;
    if (Array.isArray(arr) && typeof arr[0] === "string") return String(arr[0]).trim().slice(0, 120);
  }
  if (row.notes?.trim()) {
    const first = row.notes.trim().split(/[.;\n]/)[0]?.trim();
    if (first && first.length >= 3) return first.slice(0, 120);
  }
  return row.platform?.trim() ? `platform:${row.platform.trim()}` : null;
}

function hookTypeFromRow(row: { rawPayload: unknown; notes: string | null }): string | null {
  const raw = row.rawPayload;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const h = o.hookType ?? o.hook_type ?? o.hookStyle;
    if (typeof h === "string" && h.trim()) return norm(h).slice(0, 64);
  }
  const n = row.notes ?? "";
  if (/pov|point of view/i.test(n)) return "pov";
  if (/listicle|list of|\d+ ways/i.test(n)) return "listicle";
  if (/story|before after|transformation/i.test(n)) return "story";
  if (/contrarian|hot take|unpopular/i.test(n)) return "contrarian";
  return null;
}

function parseScoreDelta(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Pure aggregation for tests and for piping DB rows without Drizzle types.
 */
export function aggregateFeedbackFromRows(
  rows: Array<{
    sentiment: string | null;
    scoreDelta: string | null;
    rawPayload: unknown;
    notes: string | null;
    platform: string | null;
  }>
): FeedbackAggregationResult {
  if (!rows.length) {
    return { ...EMPTY };
  }

  let pos = 0;
  let neg = 0;
  let neu = 0;
  let unknown = 0;

  const topicScore = new Map<string, number>();
  const hookScore = new Map<string, number>();

  for (const row of rows) {
    const b = sentimentBucket(row.sentiment);
    if (b === "positive") pos += 1;
    else if (b === "negative") neg += 1;
    else if (b === "neutral") neu += 1;
    else unknown += 1;

    const sd = parseScoreDelta(row.scoreDelta);
    const sentimentAdj = b === "positive" ? 1 : b === "negative" ? -1 : b === "neutral" ? 0 : 0;
    const deltaAdj = sd != null ? Math.max(-2, Math.min(2, sd)) : 0;
    const weight = sentimentAdj * 0.6 + deltaAdj * 0.4 + (unknown && sd == null ? 0 : 0.1);

    const topic = topicFromRow(row);
    if (topic) {
      const k = norm(topic);
      topicScore.set(k, (topicScore.get(k) ?? 0) + weight);
    }

    const hook = hookTypeFromRow(row);
    if (hook) {
      hookScore.set(hook, (hookScore.get(hook) ?? 0) + weight);
    }
  }

  const withSentiment = pos + neg + neu;
  const positiveSentimentRatio = withSentiment > 0 ? pos / withSentiment : 0;
  const negativeSentimentRatio = withSentiment > 0 ? neg / withSentiment : 0;

  const sortedTopics = [...topicScore.entries()].sort((a, b) => b[1] - a[1]);
  const topPerformingTopics = sortedTopics
    .filter(([, s]) => s > 0)
    .slice(0, 8)
    .map(([t]) => t);
  const underperformingTopics = sortedTopics
    .filter(([, s]) => s < 0)
    .slice(-8)
    .reverse()
    .map(([t]) => t);

  const hooksRanked = [...hookScore.entries()].sort((a, b) => b[1] - a[1]);
  const topPerformingHookTypes = hooksRanked.filter(([, s]) => s > 0).slice(0, 6).map(([h]) => h);

  const degraded = rows.length < 3 && withSentiment === 0 && topicScore.size === 0;

  return {
    feedbackCount: rows.length,
    negativeSentimentRatio,
    positiveSentimentRatio,
    topPerformingTopics,
    underperformingTopics,
    topPerformingHookTypes,
    degraded,
  };
}

export type FetchFeedbackAggregationParams = {
  userId: string | null | undefined;
  clientId: string;
  trustId: string;
};

/**
 * Loads recent feedback for the same workspace as the sweep. Returns EMPTY when unauthenticated.
 */
export async function fetchFeedbackAggregationForSweep(
  params: FetchFeedbackAggregationParams
): Promise<FeedbackAggregationResult> {
  const uid = params.userId != null && String(params.userId).trim() !== "" ? String(params.userId).trim() : null;
  if (!uid) {
    return { ...EMPTY, degraded: true };
  }

  try {
    const db = await getDb();
    const since = new Date(Date.now() - LOOKBACK_MS);
    const rows = await db
      .select({
        sentiment: contentFeedbackLog.sentiment,
        scoreDelta: contentFeedbackLog.scoreDelta,
        rawPayload: contentFeedbackLog.rawPayload,
        notes: contentFeedbackLog.notes,
        platform: contentFeedbackLog.platform,
      })
      .from(contentFeedbackLog)
      .where(
        and(
          eq(contentFeedbackLog.userId, uid),
          eq(contentFeedbackLog.clientId, params.clientId ?? ""),
          eq(contentFeedbackLog.trustId, params.trustId ?? ""),
          gte(contentFeedbackLog.createdAt, since)
        )
      )
      .orderBy(desc(contentFeedbackLog.createdAt))
      .limit(500);

    return aggregateFeedbackFromRows(rows);
  } catch (e) {
    console.warn("[feedback-aggregation] query failed", e);
    return { ...EMPTY, degraded: true };
  }
}
