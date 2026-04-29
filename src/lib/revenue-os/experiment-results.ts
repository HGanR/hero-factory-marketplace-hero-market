/**
 * Experiment variant metrics. `recordExperimentResult` is also used by post-publication sync:
 * qualitativeNotes may include `[publish_sync platform=…|format=…|queue=…]` for attribution.
 */
import crypto from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  bentleyContentExperiments,
  bentleyContentExperimentResults,
  bentleyContentExperimentVariants,
} from "@/lib/db/schema";

export type ExperimentResultPayload = {
  impressions?: number | null;
  views?: number | null;
  clicks?: number | null;
  comments?: number | null;
  saves?: number | null;
  shares?: number | null;
  leads?: number | null;
  conversions?: number | null;
  negativeSentimentRatio?: number | null;
  qualitativeNotes?: string | null;
  measuredAt?: string | Date | null;
};

function clampInt(n: unknown): number | null {
  if (n == null || n === "") return null;
  const v = typeof n === "number" ? n : parseInt(String(n), 10);
  if (!Number.isFinite(v)) return null;
  return Math.max(0, Math.min(2_000_000_000, Math.floor(v)));
}

function clampRatio(n: unknown): string | null {
  if (n == null || n === "") return null;
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return null;
  const c = Math.max(0, Math.min(1, v));
  return String(c);
}

/**
 * Inserts a result row for a variant (partial metrics allowed).
 */
export async function recordExperimentResult(params: {
  experimentVariantId: string;
  payload: ExperimentResultPayload;
}): Promise<{ id: string } | null> {
  try {
    const db = await getDb();
    const id = crypto.randomUUID();
    const measuredAt =
      params.payload.measuredAt != null
        ? new Date(params.payload.measuredAt as string | Date)
        : new Date();
    await db.insert(bentleyContentExperimentResults).values({
      id,
      experimentVariantId: params.experimentVariantId,
      impressions: clampInt(params.payload.impressions),
      views: clampInt(params.payload.views),
      clicks: clampInt(params.payload.clicks),
      comments: clampInt(params.payload.comments),
      saves: clampInt(params.payload.saves),
      shares: clampInt(params.payload.shares),
      leads: clampInt(params.payload.leads),
      conversions: clampInt(params.payload.conversions),
      negativeSentimentRatio: clampRatio(params.payload.negativeSentimentRatio),
      qualitativeNotes: params.payload.qualitativeNotes?.slice(0, 8000) ?? null,
      measuredAt,
    });
    return { id };
  } catch (e) {
    console.error("[experiment-results] record failed", e);
    return null;
  }
}

export type VariantPerformanceRow = {
  variantId: string;
  variantKey: string;
  hookType: string;
  angle: string;
  ctaType: string;
  score: number;
  impressions: number;
  views: number;
  leads: number;
  conversions: number;
  negativeSentimentRatio: number;
};

function variantScore(r: {
  impressions: number | null;
  views: number | null;
  leads: number | null;
  conversions: number | null;
  negativeSentimentRatio: string | null;
}): number {
  const neg = r.negativeSentimentRatio != null ? Number(r.negativeSentimentRatio) : 0;
  const base =
    (r.views ?? 0) +
    (r.impressions ?? 0) * 0.1 +
    (r.leads ?? 0) * 40 +
    (r.conversions ?? 0) * 120;
  return base - neg * 300;
}

/**
 * Aggregates latest result per variant for an experiment (for analysis + UI).
 */
export async function getExperimentPerformanceSummary(experimentId: string): Promise<{
  variants: VariantPerformanceRow[];
  experimentTheme: string | null;
} | null> {
  try {
    const db = await getDb();
    const exp = await db
      .select()
      .from(bentleyContentExperiments)
      .where(eq(bentleyContentExperiments.id, experimentId))
      .limit(1);
    if (!exp[0]) return null;

    const vars = await db
      .select()
      .from(bentleyContentExperimentVariants)
      .where(eq(bentleyContentExperimentVariants.experimentId, experimentId));

    const rows: VariantPerformanceRow[] = [];
    for (const v of vars) {
      const latest = await db
        .select()
        .from(bentleyContentExperimentResults)
        .where(eq(bentleyContentExperimentResults.experimentVariantId, v.id))
        .orderBy(desc(bentleyContentExperimentResults.measuredAt))
        .limit(1);
      const res = latest[0];
      const score = res
        ? variantScore({
            impressions: res.impressions,
            views: res.views,
            leads: res.leads,
            conversions: res.conversions,
            negativeSentimentRatio: res.negativeSentimentRatio,
          })
        : 0;
      rows.push({
        variantId: v.id,
        variantKey: v.variantKey,
        hookType: v.hookType,
        angle: v.angle,
        ctaType: v.ctaType,
        score,
        impressions: res?.impressions ?? 0,
        views: res?.views ?? 0,
        leads: res?.leads ?? 0,
        conversions: res?.conversions ?? 0,
        negativeSentimentRatio: res?.negativeSentimentRatio != null ? Number(res.negativeSentimentRatio) : 0,
      });
    }
    rows.sort((a, b) => b.score - a.score);
    return {
      variants: rows,
      experimentTheme: exp[0].experimentTheme ?? null,
    };
  } catch (e) {
    console.error("[experiment-results] summary failed", e);
    return null;
  }
}

export type ExperimentLearningAugmentation = {
  boostHookTypes: string[];
  suppressAngles: string[];
  promotionThemes: string[];
};

const EMPTY_AUG: ExperimentLearningAugmentation = {
  boostHookTypes: [],
  suppressAngles: [],
  promotionThemes: [],
};

/**
 * Pulls recent experiment outcomes to bias feedback aggregation (hook + angle signals).
 */
export async function fetchExperimentAugmentationForSweep(params: {
  userId: string | null;
  clientId: string;
  trustId: string;
}): Promise<ExperimentLearningAugmentation> {
  if (!params.userId) return { ...EMPTY_AUG };
  try {
    const db = await getDb();
    const exps = await db
      .select({ id: bentleyContentExperiments.id })
      .from(bentleyContentExperiments)
      .where(
        and(
          eq(bentleyContentExperiments.userId, String(params.userId)),
          eq(bentleyContentExperiments.clientId, params.clientId ?? ""),
          eq(bentleyContentExperiments.trustId, params.trustId ?? ""),
          inArray(bentleyContentExperiments.status, ["active", "completed", "draft"])
        )
      )
      .orderBy(desc(bentleyContentExperiments.createdAt))
      .limit(8);

    if (!exps.length) return { ...EMPTY_AUG };

    const boostHookTypes = new Set<string>();
    const suppressAngles = new Set<string>();
    const promotionThemes = new Set<string>();

    for (const e of exps) {
      const summary = await getExperimentPerformanceSummary(e.id);
      if (!summary?.variants.length) continue;
      const ranked = summary.variants.filter((v) => v.score !== 0 || v.views > 0 || v.leads > 0);
      if (ranked.length < 2) continue;
      const top = ranked[0];
      const bottom = ranked[ranked.length - 1];
      if (top.score > bottom.score && top.hookType) boostHookTypes.add(top.hookType);
      if (top.score > bottom.score && bottom.angle) suppressAngles.add(bottom.angle.slice(0, 120));
      if (summary.experimentTheme) promotionThemes.add(summary.experimentTheme.slice(0, 120));
    }

    return {
      boostHookTypes: [...boostHookTypes].slice(0, 12),
      suppressAngles: [...suppressAngles].slice(0, 12),
      promotionThemes: [...promotionThemes].slice(0, 8),
    };
  } catch (e) {
    console.warn("[experiment-results] augmentation fetch failed", e);
    return { ...EMPTY_AUG };
  }
}
