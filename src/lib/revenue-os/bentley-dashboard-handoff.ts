import { INDUSTRY_PROFILES, type IndustryKey } from "@/lib/revenue-os/industry-profiles";
import {
  parseIndustryKey,
  structuredGuidedIntakeCompleteForCampaign,
  type BentleySnapshot,
} from "@/lib/revenue-os/bentley-orchestrator";
import {
  buildBaselineCampaignNotesFromIntake,
  BENTLEY_CAMPAIGN_NOTES_MIN,
} from "@/lib/revenue-os/bentley-auto-campaign-notes";
import { buildBentleyNotesPayload } from "@/lib/revenue-os/bentley-notes-payload";
import { loadWorkflowState, type BentleyWorkflowArtifacts } from "@/lib/revenue-os/bentley-workflow";
import { effectiveIndustryLabelFromSnapshot } from "@/lib/revenue-os/bentley-section-readiness";
import {
  BENTLEY_DASHBOARD_HANDOFF_VERSION,
  BENTLEY_DASHBOARD_HANDOFF_VERSION_LEGACY,
  type BentleyDashboardHandoffEnvelope,
  type BentleyDashboardHandoffPayload,
} from "@/lib/revenue-os/bentley-dashboard-types";
import {
  dedupePostingPlatforms,
  mapLabelsToPostingPlatforms,
} from "@/lib/revenue-os/bentley-posting-platforms";
import type { SocialPlatform } from "@/lib/social/config";
import { RevenueOsAnalyzeRequestSchema } from "@/lib/validators/revenue-os";
import {
  normalizeDashboardFormValues,
  type RevenueOsDashboardFormValues,
} from "@/lib/revenue-os/run-revenue-os-analysis";
import {
  readBentleySessionWithLegacyFallback,
  removeBentleySessionScopedAndLegacy,
} from "@/lib/revenue-os/bentley-storage-scope";

export const BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY = "revenue-os:bentley-handoff";
/** Set when the user has edited the dashboard form this session — Bentley must not overwrite */
export const REVENUE_OS_DASHBOARD_USER_TOUCHED_KEY = "revenue-os:dashboard-user-touched";

/** Call when Bentley writes a fresh dashboard handoff so hydration is not blocked by a prior edit session. */
export function clearDashboardUserTouchedForIncomingBentleyHandoff(): void {
  if (typeof window === "undefined") return;
  removeBentleySessionScopedAndLegacy(REVENUE_OS_DASHBOARD_USER_TOUCHED_KEY);
}
/** Shown as a subtle badge until cleared */
export const REVENUE_OS_BENTLEY_PREPARED_BADGE_KEY = "revenue-os:bentley-prepared-badge";
/**
 * Last merged dashboard form after a Bentley handoff (session-only).
 * Lets the dashboard survive refresh before the user edits the form.
 */
export const REVENUE_OS_BENTLEY_APPLIED_FORM_KEY = "revenue-os:bentley-applied-form";
/**
 * Set by BentleyDashboardBridge immediately before queued autorun.
 * Removed when `runRevenueOsFullAnalysis` starts so only one autorun is attributed.
 */
export const REVENUE_OS_BENTLEY_AUTORUN_PENDING_KEY = "revenue-os:bentley-autorun-pending";
/**
 * Session-only persistence for Bentley completion UI after refresh.
 * JSON: `{ status: 'complete' | 'failed', message?: string, at: number }`
 */
export const REVENUE_OS_BENTLEY_ANALYSIS_SESSION_KEY = "revenue-os:bentley-analysis-session";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build a dashboard handoff payload from the current Bentley snapshot (single source of truth).
 */
export function buildBentleyDashboardPayload(
  snap: BentleySnapshot,
  opts?: { autoRunFullAnalysis?: boolean }
): BentleyDashboardHandoffPayload {
  const industryLabel = effectiveIndustryLabelFromSnapshot(snap);
  const traffic = Math.max(0, Math.round(snap.traffic || 0));
  const conv = snap.conversionRate > 0 ? snap.conversionRate : 1;
  const aov = snap.aov > 0 ? snap.aov : 5000;
  const modeled = traffic > 0 && conv > 0 && aov > 0 ? traffic * (conv / 100) * aov : 0;
  const currentMonthlyRevenue = modeled > 0 ? roundMoney(modeled) : 20_000;
  const targetMonthlyRevenue = Math.max(
    roundMoney(currentMonthlyRevenue * 5),
    100_000
  );

  const cac = 250;
  const ltv = Math.max(roundMoney(aov * 2), aov);

  return {
    v: BENTLEY_DASHBOARD_HANDOFF_VERSION,
    createdAt: new Date().toISOString(),
    businessName: snap.businessName.trim() || "Your business",
    industryKey: snap.industryKey,
    contentIndustry: snap.contentIndustry.trim(),
    businessType:
      industryLabel ||
      (snap.industryKey != null && snap.industryKey in INDUSTRY_PROFILES
        ? INDUSTRY_PROFILES[snap.industryKey].label
        : "Consulting"),
    targetAudience: snap.targetAudience.trim() || "General audience",
    market: "USA",
    currentMonthlyRevenue,
    targetMonthlyRevenue,
    grossMarginPct: 70,
    monthlyTraffic: traffic > 0 ? traffic : 8000,
    conversionRatePct: conv,
    avgOrderValue: aov,
    cac,
    ltv,
    coreOffer: snap.coreOffer.trim(),
    transformation: snap.transformation.trim(),
    platforms: [...snap.platforms],
    postingPlatforms: dedupePostingPlatforms(snap.postingPlatforms ?? []),
    tone: snap.tone.trim() || "Professional",
    contentTypeFocus: snap.contentType.trim() || "Full Post",
    imageStyle: snap.imageStyle.trim() || "cinematic",
    notes: snap.campaignNotes.trim(),
    autoRunFullAnalysis: Boolean(opts?.autoRunFullAnalysis),
  };
}

function coerceIndustryKeyFromPayload(k: string | null): IndustryKey | null {
  if (!k) return null;
  return k in INDUSTRY_PROFILES ? (k as IndustryKey) : null;
}

/** Reconstruct guided-intake snapshot from a dashboard handoff payload (resume / dashboard orchestration). */
export function bentleySnapshotFromHandoffPayload(p: BentleyDashboardHandoffPayload): BentleySnapshot {
  return {
    industryKey: coerceIndustryKeyFromPayload(p.industryKey),
    contentIndustry: p.contentIndustry ?? "",
    targetAudience: p.targetAudience ?? "",
    traffic: typeof p.monthlyTraffic === "number" ? p.monthlyTraffic : 0,
    conversionRate: typeof p.conversionRatePct === "number" ? p.conversionRatePct : 0,
    aov: typeof p.avgOrderValue === "number" ? p.avgOrderValue : 0,
    businessName: p.businessName ?? "",
    coreOffer: p.coreOffer ?? "",
    transformation: p.transformation ?? "",
    platforms: Array.isArray(p.platforms) ? [...p.platforms] : [],
    tone: p.tone ?? "",
    contentType: p.contentTypeFocus ?? "",
    imageStyle: p.imageStyle ?? "",
    campaignNotes: p.notes ?? "",
    postingPlatforms: dedupePostingPlatforms(p.postingPlatforms ?? []),
  };
}

/**
 * Reconstructs a Bentley snapshot patch from persisted dashboard form (session backup after handoff).
 * Best-effort `industryKey` from `businessType` so guided intake does not restart at “industry” after refresh.
 */
export function bentleySnapshotPatchFromPersistedDashboardForm(form: RevenueOsDashboardFormValues): Partial<BentleySnapshot> {
  const base = bentleySnapshotFromDashboardForm(form);
  const head = form.businessType.split("/")[0]?.trim() ?? "";
  const industryGuess = parseIndustryKey(form.businessType) ?? parseIndustryKey(head) ?? null;
  return {
    ...base,
    industryKey: industryGuess,
  };
}

/** Maps live dashboard form state into a Bentley snapshot (Revenue OS dashboard ↔ chat / workflow). */
export function bentleySnapshotFromDashboardForm(form: RevenueOsDashboardFormValues): BentleySnapshot {
  return {
    industryKey: null,
    contentIndustry: form.businessType.trim(),
    targetAudience: form.targetAudience.trim(),
    traffic: typeof form.monthlyTraffic === "number" ? form.monthlyTraffic : 0,
    conversionRate: typeof form.conversionRatePct === "number" ? form.conversionRatePct : 0,
    aov: typeof form.avgOrderValue === "number" ? form.avgOrderValue : 0,
    businessName: form.businessName.trim(),
    coreOffer: form.coreOffer.trim(),
    transformation: form.transformation.trim(),
    platforms: Array.isArray(form.platforms) ? [...form.platforms] : [],
    postingPlatforms: dedupePostingPlatforms(form.postingPlatforms ?? []),
    tone: form.tone.trim(),
    contentType: form.contentTypeFocus.trim(),
    imageStyle: form.imageStyle.trim(),
    campaignNotes: form.notes.trim(),
  };
}

/**
 * Pure merge: handoff payload + workflow artifacts → snapshot with Bentley intelligence in `campaignNotes`.
 */
export function mergeBentleySnapshotFromHandoffAndArtifacts(
  p: BentleyDashboardHandoffPayload,
  artifacts: BentleyWorkflowArtifacts,
): BentleySnapshot {
  const base = bentleySnapshotFromHandoffPayload(p);
  const mergedNotes = buildBentleyNotesPayload({ snapshot: base, ...artifacts }).trim();
  if (mergedNotes.length >= BENTLEY_CAMPAIGN_NOTES_MIN) {
    return { ...base, campaignNotes: mergedNotes };
  }
  if (structuredGuidedIntakeCompleteForCampaign(base)) {
    return { ...base, campaignNotes: buildBaselineCampaignNotesFromIntake(base) };
  }
  return base;
}

/** Same merge using live `sessionStorage` workflow (client-only). */
export function hydrateBentleySnapshotFromHandoffPayload(p: BentleyDashboardHandoffPayload): BentleySnapshot {
  return mergeBentleySnapshotFromHandoffAndArtifacts(p, loadWorkflowState().artifacts);
}

/**
 * Read current handoff from storage and merge workflow artifacts into notes (dashboard resume).
 */
export function readBentleySnapshotForDashboard(): BentleySnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = readBentleySessionWithLegacyFallback(BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY);
    if (!raw) return null;
    const env = parseBentleyDashboardPayload(raw);
    if (!env?.payload) return null;
    return mergeBentleySnapshotFromHandoffAndArtifacts(env.payload, loadWorkflowState().artifacts);
  } catch {
    return null;
  }
}

/** Rebuild `form.notes` from workflow artifacts (research, trends, sweep, synthesis, …). */
export function enrichDashboardFormNotesFromWorkflowArtifacts(
  form: RevenueOsDashboardFormValues,
  artifacts: BentleyWorkflowArtifacts,
): RevenueOsDashboardFormValues {
  const base = bentleySnapshotFromDashboardForm(form);
  const merged = buildBentleyNotesPayload({ snapshot: base, ...artifacts }).trim();
  if (merged.length < BENTLEY_CAMPAIGN_NOTES_MIN) return form;
  return normalizeDashboardFormValues({ ...form, notes: merged });
}

export function enrichDashboardFormNotesFromWorkflow(form: RevenueOsDashboardFormValues): RevenueOsDashboardFormValues {
  if (typeof window === "undefined") return form;
  return enrichDashboardFormNotesFromWorkflowArtifacts(form, loadWorkflowState().artifacts);
}

/**
 * Overlap between dashboard form and Bentley snapshot (fields mirrored both ways on /revenue-os/dashboard).
 * Does not include: market, currentMonthlyRevenue, targetMonthlyRevenue, grossMarginPct, cac, ltv.
 */
export function dashboardFormPatchFromBentleySnapshot(snap: BentleySnapshot): Partial<RevenueOsDashboardFormValues> {
  const businessType =
    snap.industryKey != null && snap.industryKey in INDUSTRY_PROFILES
      ? INDUSTRY_PROFILES[snap.industryKey as IndustryKey].label
      : snap.contentIndustry.trim();
  return {
    businessName: snap.businessName.trim(),
    businessType,
    targetAudience: snap.targetAudience.trim(),
    monthlyTraffic: snap.traffic,
    conversionRatePct: snap.conversionRate,
    avgOrderValue: snap.aov,
    coreOffer: snap.coreOffer.trim(),
    transformation: snap.transformation.trim(),
    platforms: Array.isArray(snap.platforms) ? [...snap.platforms] : [],
    postingPlatforms: dedupePostingPlatforms(snap.postingPlatforms ?? []),
    tone: snap.tone.trim(),
    contentTypeFocus: snap.contentType.trim(),
    imageStyle: snap.imageStyle.trim(),
    notes: snap.campaignNotes.trim(),
  };
}

function postingPlatformsEqual(a: SocialPlatform[], b: SocialPlatform[]): boolean {
  return JSON.stringify(dedupePostingPlatforms(a)) === JSON.stringify(dedupePostingPlatforms(b));
}

/** Applies only fields that differ so mirror does not churn when snapshot already matches the form. */
export function dashboardFormPatchFromBentleySnapshotIfDiff(
  snap: BentleySnapshot,
  form: RevenueOsDashboardFormValues
): Partial<RevenueOsDashboardFormValues> {
  const want = dashboardFormPatchFromBentleySnapshot(snap);
  const out: Partial<RevenueOsDashboardFormValues> = {};
  if (want.businessName !== undefined && want.businessName !== form.businessName) out.businessName = want.businessName;
  if (want.businessType !== undefined && want.businessType !== form.businessType) out.businessType = want.businessType;
  if (want.targetAudience !== undefined && want.targetAudience !== form.targetAudience) out.targetAudience = want.targetAudience;
  if (want.monthlyTraffic !== undefined && want.monthlyTraffic !== form.monthlyTraffic) out.monthlyTraffic = want.monthlyTraffic;
  if (want.conversionRatePct !== undefined && want.conversionRatePct !== form.conversionRatePct) {
    out.conversionRatePct = want.conversionRatePct;
  }
  if (want.avgOrderValue !== undefined && want.avgOrderValue !== form.avgOrderValue) out.avgOrderValue = want.avgOrderValue;
  if (want.coreOffer !== undefined && want.coreOffer !== form.coreOffer) out.coreOffer = want.coreOffer;
  if (want.transformation !== undefined && want.transformation !== form.transformation) out.transformation = want.transformation;
  if (want.platforms !== undefined && JSON.stringify(want.platforms) !== JSON.stringify(form.platforms)) {
    out.platforms = want.platforms;
  }
  if (want.postingPlatforms !== undefined && !postingPlatformsEqual(want.postingPlatforms, form.postingPlatforms)) {
    out.postingPlatforms = want.postingPlatforms;
  }
  if (want.tone !== undefined && want.tone !== form.tone) out.tone = want.tone;
  if (want.contentTypeFocus !== undefined && want.contentTypeFocus !== form.contentTypeFocus) {
    out.contentTypeFocus = want.contentTypeFocus;
  }
  if (want.imageStyle !== undefined && want.imageStyle !== form.imageStyle) out.imageStyle = want.imageStyle;
  if (want.notes !== undefined && want.notes !== form.notes) out.notes = want.notes;
  return out;
}

export function serializeBentleyDashboardHandoff(env: BentleyDashboardHandoffEnvelope): string {
  return JSON.stringify(env);
}

export function parseBentleyDashboardPayload(raw: string): BentleyDashboardHandoffEnvelope | null {
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return null;
    const env = j as BentleyDashboardHandoffEnvelope;
    if (!env.payload || typeof env.payload !== "object") return null;
    const v = env.payload.v;
    if (v !== BENTLEY_DASHBOARD_HANDOFF_VERSION_LEGACY && v !== BENTLEY_DASHBOARD_HANDOFF_VERSION) {
      return null;
    }
    return env;
  } catch {
    return null;
  }
}

/** Canonical posting intent from any handoff version. */
export function postingPlatformsFromHandoffPayload(p: BentleyDashboardHandoffPayload): SocialPlatform[] {
  if (p.v === BENTLEY_DASHBOARD_HANDOFF_VERSION && Array.isArray(p.postingPlatforms)) {
    return dedupePostingPlatforms(p.postingPlatforms);
  }
  return mapLabelsToPostingPlatforms(p.platforms);
}

/** Minimum to show a useful dashboard (hydration) — narrative industry + business identity */
export function hasMinimumFieldsForDashboard(p: BentleyDashboardHandoffPayload): boolean {
  return (
    (p.businessType.trim().length >= 2 || p.contentIndustry.trim().length >= 2) &&
    p.businessName.trim().length >= 1
  );
}

/**
 * Validates that the numeric profile can be POSTed to `/api/revenue-os/analyze`.
 * Uses a placeholder userId — only `profile` fields are validated by the schema.
 */
export function hasMinimumFieldsForFullAnalysis(p: BentleyDashboardHandoffPayload): {
  ok: true;
} | {
  ok: false;
  missing: string[];
} {
  const profile = {
    userId: "bentley-validation",
    businessName: p.businessName,
    businessType: p.businessType,
    market: p.market,
    currentMonthlyRevenue: p.currentMonthlyRevenue,
    targetMonthlyRevenue: p.targetMonthlyRevenue,
    avgOrderValue: p.avgOrderValue,
    grossMarginPct: p.grossMarginPct,
    monthlyTraffic: Math.round(p.monthlyTraffic),
    conversionRatePct: p.conversionRatePct,
    cac: p.cac,
    ltv: p.ltv,
  };
  const parsed = RevenueOsAnalyzeRequestSchema.safeParse({ profile });
  if (parsed.success) return { ok: true };

  return {
    ok: false,
    missing: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
  };
}

/** Turn Zod paths into short operator-facing labels for Bentley chat / UI. */
export function humanizeMissingFieldsForFullAnalysis(missing: string[]): string[] {
  return missing.map((line) => {
    const p = line.toLowerCase();
    if (p.includes("currentmonthlyrevenue")) return "Current monthly revenue (USD / month)";
    if (p.includes("targetmonthlyrevenue")) return "Target monthly revenue (USD / month)";
    if (p.includes("avgordervalue")) return "Average order value (AOV)";
    if (p.includes("grossmarginpct")) return "Gross margin %";
    if (p.includes("monthlytraffic")) return "Monthly traffic (sessions or visitors)";
    if (p.includes("conversionratepct")) return "Conversion rate %";
    if (p.includes("cac")) return "Customer acquisition cost (CAC)";
    if (p.includes("ltv")) return "Lifetime value (LTV)";
    if (p.includes("market")) return "Market / region";
    if (p.includes("businesstype")) return "Business type / industry";
    if (p.includes("businessname")) return "Business name";
    return line.split(":").pop()?.trim() ?? line;
  });
}

/**
 * Maps handoff payload into dashboard form state (metrics + strategic context).
 * Not applied: `industryKey`, `contentIndustry` (industry narrative is in `businessType`).
 */
export function payloadToDashboardFormState(p: BentleyDashboardHandoffPayload): {
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
  coreOffer: string;
  transformation: string;
  platforms: string[];
  postingPlatforms: SocialPlatform[];
  tone: string;
  contentTypeFocus: string;
  imageStyle: string;
  notes: string;
} {
  return {
    businessName: p.businessName,
    businessType: p.businessType,
    targetAudience: p.targetAudience,
    market: p.market,
    currentMonthlyRevenue: p.currentMonthlyRevenue,
    targetMonthlyRevenue: p.targetMonthlyRevenue,
    avgOrderValue: p.avgOrderValue,
    grossMarginPct: p.grossMarginPct,
    monthlyTraffic: p.monthlyTraffic,
    conversionRatePct: p.conversionRatePct,
    cac: p.cac,
    ltv: p.ltv,
    coreOffer: p.coreOffer,
    transformation: p.transformation,
    platforms: [...p.platforms],
    postingPlatforms: postingPlatformsFromHandoffPayload(p),
    tone: p.tone,
    contentTypeFocus: p.contentTypeFocus,
    imageStyle: p.imageStyle,
    notes: p.notes,
  };
}
