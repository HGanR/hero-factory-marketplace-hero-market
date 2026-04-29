import type { SocialPlatform } from "@/lib/social/config";
import { bentleyJsonPostHeaders } from "@/lib/revenue-os/bentley-request-correlation";
import { dedupePostingPlatforms, isOauthConnectablePlatform } from "@/lib/revenue-os/bentley-posting-platforms";
import { buildTrendsPatternsBlockForAnalysis, type TrendsContext } from "@/lib/revenue-os/notes-engine";
import type { TrendsResponse } from "@/lib/revenue-os/trends-schema";
import { RevenueOsAnalyzeRequestSchema } from "@/lib/validators/revenue-os";
import type { RevenueOsAnalyzeResponse } from "@/lib/validators/revenue-os";

export type RevenueOsDashboardFormValues = {
  businessName: string;
  businessType: string;
  targetAudience: string;
  market: string;
  currentMonthlyRevenue: number;
  targetMonthlyRevenue: number;
  avgOrderValue: number;
  grossMarginPct: number;
  monthlyTraffic: number;
  conversionRatePct: number;
  cac: number;
  ltv: number;
  /** Strategic context — optional for analysis; Bentley / manual */
  coreOffer: string;
  transformation: string;
  /**
   * Content / strategy channel labels (e.g. "Instagram", "YouTube") for analysis context and generation.
   * Distinct from `postingPlatforms`: this list does not grant OAuth or publish by itself.
   */
  platforms: string[];
  /** OAuth-capable networks selected for connect & publish (Hero Factory integrations). */
  postingPlatforms: SocialPlatform[];
  tone: string;
  contentTypeFocus: string;
  imageStyle: string;
  notes: string;
};

export const EMPTY_DASHBOARD_CONTEXT: Pick<
  RevenueOsDashboardFormValues,
  | "coreOffer"
  | "transformation"
  | "platforms"
  | "postingPlatforms"
  | "tone"
  | "contentTypeFocus"
  | "imageStyle"
  | "notes"
> = {
  coreOffer: "",
  transformation: "",
  platforms: [],
  postingPlatforms: [],
  tone: "",
  contentTypeFocus: "",
  imageStyle: "",
  notes: "",
};

/** Safe parse for sessionStorage restore (Bentley applied-form backup). */
export function isRevenueOsDashboardFormValues(x: unknown): x is RevenueOsDashboardFormValues {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const base =
    typeof o.businessName === "string" &&
    typeof o.businessType === "string" &&
    typeof o.targetAudience === "string" &&
    typeof o.market === "string" &&
    typeof o.currentMonthlyRevenue === "number" &&
    typeof o.targetMonthlyRevenue === "number" &&
    typeof o.avgOrderValue === "number" &&
    typeof o.grossMarginPct === "number" &&
    typeof o.monthlyTraffic === "number" &&
    typeof o.conversionRatePct === "number" &&
    typeof o.cac === "number" &&
    typeof o.ltv === "number";
  if (!base) return false;
  const ctx =
    (o.coreOffer === undefined || typeof o.coreOffer === "string") &&
    (o.transformation === undefined || typeof o.transformation === "string") &&
    (o.platforms === undefined || Array.isArray(o.platforms)) &&
    (o.postingPlatforms === undefined ||
      (Array.isArray(o.postingPlatforms) &&
        o.postingPlatforms.every((x) => typeof x === "string" && isOauthConnectablePlatform(x)))) &&
    (o.tone === undefined || typeof o.tone === "string") &&
    (o.contentTypeFocus === undefined || typeof o.contentTypeFocus === "string") &&
    (o.imageStyle === undefined || typeof o.imageStyle === "string") &&
    (o.notes === undefined || typeof o.notes === "string");
  return Boolean(ctx);
}

/** Merge legacy session snapshots that omit context fields. */
export function normalizeDashboardFormValues(o: RevenueOsDashboardFormValues): RevenueOsDashboardFormValues {
  return {
    ...o,
    coreOffer: typeof o.coreOffer === "string" ? o.coreOffer : "",
    transformation: typeof o.transformation === "string" ? o.transformation : "",
    platforms: Array.isArray(o.platforms) ? o.platforms.filter((x) => typeof x === "string") : [],
    postingPlatforms: dedupePostingPlatforms(
      Array.isArray(o.postingPlatforms)
        ? (o.postingPlatforms.filter((x) => typeof x === "string") as SocialPlatform[])
        : []
    ),
    tone: typeof o.tone === "string" ? o.tone : "",
    contentTypeFocus: typeof o.contentTypeFocus === "string" ? o.contentTypeFocus : "",
    imageStyle: typeof o.imageStyle === "string" ? o.imageStyle : "",
    notes: typeof o.notes === "string" ? o.notes : "",
  };
}

const NOTES_MAX = 5000;

/**
 * Appends dashboard Trends Library results to form notes before Run Analysis (workflow merge is separate).
 */
export function appendDashboardTrendsToFormNotes(
  form: RevenueOsDashboardFormValues,
  trends: TrendsResponse | null | undefined,
): RevenueOsDashboardFormValues {
  if (!trends) return form;
  const ctx: TrendsContext = {
    industry: trends.industry,
    targetAudience: trends.targetAudience,
    items: trends.items,
    campaignAngles: trends.campaignAngles,
    contentBlueprints: trends.contentBlueprints,
  };
  const block = buildTrendsPatternsBlockForAnalysis(ctx);
  if (!block) return form;
  const n = form.notes.trim();
  const combined = (n ? `${n}\n\n` : "") + block;
  return normalizeDashboardFormValues({ ...form, notes: combined.slice(0, NOTES_MAX) });
}

/**
 * Builds optional `notes` + `constraints` for `/api/revenue-os/analyze` from dashboard context.
 * Nothing is required — omitted when all context is empty.
 */
export function buildRevenueOsAnalysisContextPayload(form: RevenueOsDashboardFormValues): {
  notes?: string;
  constraints?: Record<string, unknown>;
} {
  const bentley = {
    targetAudience: form.targetAudience.trim(),
    coreOffer: form.coreOffer.trim(),
    transformation: form.transformation.trim(),
    platforms: form.platforms,
    postingPlatforms: form.postingPlatforms,
    tone: form.tone.trim(),
    contentTypeFocus: form.contentTypeFocus.trim(),
    imageStyle: form.imageStyle.trim(),
    campaignNotes: form.notes.trim(),
  };

  const hasStructured = Object.entries(bentley).some(([k, v]) => {
    if (k === "platforms" || k === "postingPlatforms") return Array.isArray(v) && v.length > 0;
    return typeof v === "string" && v.length > 0;
  });

  const lines: string[] = [];
  if (bentley.targetAudience) lines.push(`Target audience: ${bentley.targetAudience}`);
  if (bentley.coreOffer) lines.push(`Core offer: ${bentley.coreOffer}`);
  if (bentley.transformation) lines.push(`Transformation / outcome: ${bentley.transformation}`);
  if (bentley.platforms.length) lines.push(`Platforms: ${bentley.platforms.join(", ")}`);
  if (bentley.postingPlatforms.length) {
    lines.push(`Posting targets (OAuth): ${bentley.postingPlatforms.join(", ")}`);
  }
  if (bentley.tone) lines.push(`Tone: ${bentley.tone}`);
  if (bentley.contentTypeFocus) lines.push(`Content focus: ${bentley.contentTypeFocus}`);
  if (bentley.imageStyle) lines.push(`Image style: ${bentley.imageStyle}`);
  if (bentley.campaignNotes) lines.push(`Campaign / intake notes: ${bentley.campaignNotes}`);

  const notes =
    lines.length > 0 ? lines.join("\n\n").slice(0, NOTES_MAX) : undefined;

  return {
    notes,
    constraints: hasStructured ? { bentley } : undefined,
  };
}

/**
 * Same POST body as the dashboard “Run Analysis” button — shared by UI and Bentley bridge.
 */
export async function runRevenueOsFullAnalysis(
  userId: string,
  form: RevenueOsDashboardFormValues
): Promise<
  { ok: true; data: RevenueOsAnalyzeResponse } | { ok: false; message: string }
> {
  const ctx = buildRevenueOsAnalysisContextPayload(form);
  const payload = {
    profile: {
      userId,
      businessName: form.businessName,
      businessType: form.businessType,
      market: form.market,
      currentMonthlyRevenue: Number(form.currentMonthlyRevenue),
      targetMonthlyRevenue: Number(form.targetMonthlyRevenue),
      avgOrderValue: Number(form.avgOrderValue),
      grossMarginPct: Number(form.grossMarginPct),
      monthlyTraffic: Math.round(Number(form.monthlyTraffic)),
      conversionRatePct: Number(form.conversionRatePct),
      cac: Number(form.cac),
      ltv: Number(form.ltv),
      ...(ctx.notes ? { notes: ctx.notes } : {}),
      ...(ctx.constraints ? { constraints: ctx.constraints } : {}),
    },
  };

  const parsed = RevenueOsAnalyzeRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.map((i) => i.message).join("; ") || "Invalid inputs",
    };
  }

  try {
    const r = await fetch("/api/revenue-os/analyze", {
      method: "POST",
      headers: bentleyJsonPostHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(typeof data?.message === "string" ? data.message : "Analyze failed");
    return { ok: true, data: data as RevenueOsAnalyzeResponse };
  } catch (e: unknown) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Analyze failed",
    };
  }
}
