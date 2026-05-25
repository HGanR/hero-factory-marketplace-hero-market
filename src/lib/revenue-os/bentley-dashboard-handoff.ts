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
  type BentleyDashboardAutoRunMode,
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
  coercePlatformLabelStrings,
  normalizeDashboardFormValues,
  type RevenueOsDashboardFormValues,
} from "@/lib/revenue-os/run-revenue-os-analysis";
import { coerceIndustryKey, coerceTrimmedString, dashboardIndustryHead, normalizeBentleyDashboardHandoffPayload } from "@/lib/revenue-os/bentley-string-coerce";
import {
  readBentleySessionWithLegacyFallback,
  removeBentleySessionScopedAndLegacy,
} from "@/lib/revenue-os/bentley-storage-scope";

export const BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY = "revenue-os:bentley-handoff";
/**
 * Set when the user has edited the dashboard form this session.
 * Blocks session-only restore from `REVENUE_OS_BENTLEY_APPLIED_FORM_KEY` when there is no fresh handoff.
 * A parsed `BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY` handoff always clears this and merges (explicit open-dashboard).
 */
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
 * Set by BentleyDashboardBridge when handoff requests full pipeline (research → … → analysis), not immediate `/analyze`.
 * Consumed by dashboard `BentleyDashboardPipelineAutorun` after shared Bentley state is ready.
 */
export const REVENUE_OS_BENTLEY_AUTORUN_FULL_PIPELINE_KEY = "revenue-os:bentley-autorun-full-pipeline";
/**
 * Session-only persistence for Bentley completion UI after refresh.
 * JSON: `{ status: 'complete' | 'failed', message?: string, at: number }`
 */
export const REVENUE_OS_BENTLEY_ANALYSIS_SESSION_KEY = "revenue-os:bentley-analysis-session";

const AUTO_RUN_MODES: readonly BentleyDashboardAutoRunMode[] = ["off", "analysis_only", "full_pipeline"];

export function resolveBentleyDashboardAutoRunMode(p: BentleyDashboardHandoffPayload): BentleyDashboardAutoRunMode {
  const m = p.autoRunMode;
  if (m && AUTO_RUN_MODES.includes(m)) return m;
  return p.autoRunFullAnalysis ? "full_pipeline" : "off";
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build a dashboard handoff payload from the current Bentley snapshot (single source of truth).
 */
export function buildBentleyDashboardPayload(
  snap: BentleySnapshot,
  opts?: { autoRunFullAnalysis?: boolean; autoRunMode?: BentleyDashboardAutoRunMode }
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
    businessName: coerceTrimmedString(snap.businessName) || "Your business",
    industryKey: snap.industryKey,
    contentIndustry: coerceTrimmedString(snap.contentIndustry),
    businessType:
      industryLabel ||
      (snap.industryKey != null && snap.industryKey in INDUSTRY_PROFILES
        ? INDUSTRY_PROFILES[snap.industryKey].label
        : "Consulting"),
    targetAudience: coerceTrimmedString(snap.targetAudience) || "General audience",
    market: "USA",
    currentMonthlyRevenue,
    targetMonthlyRevenue,
    grossMarginPct: 70,
    monthlyTraffic: traffic > 0 ? traffic : 8000,
    conversionRatePct: conv,
    avgOrderValue: aov,
    cac,
    ltv,
    coreOffer: coerceTrimmedString(snap.coreOffer),
    transformation: coerceTrimmedString(snap.transformation),
    platforms: coercePlatformLabelStrings(snap.platforms),
    postingPlatforms: dedupePostingPlatforms(snap.postingPlatforms ?? []),
    tone: coerceTrimmedString(snap.tone) || "Professional",
    contentTypeFocus: coerceTrimmedString(snap.contentType) || "Full Post",
    imageStyle: coerceTrimmedString(snap.imageStyle) || "cinematic",
    notes: coerceTrimmedString(snap.campaignNotes),
    autoRunFullAnalysis: Boolean(opts?.autoRunFullAnalysis),
    autoRunMode:
      opts?.autoRunMode ?? (opts?.autoRunFullAnalysis ? "full_pipeline" : "off"),
  };
}

/** Reconstruct guided-intake snapshot from a dashboard handoff payload (resume / dashboard orchestration). */
export function bentleySnapshotFromHandoffPayload(p: BentleyDashboardHandoffPayload): BentleySnapshot {
  const n = normalizeBentleyDashboardHandoffPayload(p);
  return {
    industryKey: coerceIndustryKey(n.industryKey),
    contentIndustry: n.contentIndustry,
    targetAudience: n.targetAudience,
    traffic: n.monthlyTraffic,
    conversionRate: n.conversionRatePct,
    aov: n.avgOrderValue,
    businessName: n.businessName,
    coreOffer: n.coreOffer,
    transformation: n.transformation,
    platforms: n.platforms,
    tone: n.tone,
    contentType: n.contentTypeFocus,
    imageStyle: n.imageStyle,
    campaignNotes: n.notes,
    postingPlatforms: dedupePostingPlatforms(n.postingPlatforms ?? []),
  };
}

/**
 * Reconstructs a Bentley snapshot patch from persisted dashboard form (session backup after handoff).
 * Best-effort `industryKey` from `businessType` so guided intake does not restart at “industry” after refresh.
 */
export function bentleySnapshotPatchFromPersistedDashboardForm(form: RevenueOsDashboardFormValues): Partial<BentleySnapshot> {
  const base = bentleySnapshotFromDashboardForm(form);
  const f = normalizeDashboardFormValues(form);
  const head = dashboardIndustryHead(f.businessType);
  const industryGuess = parseIndustryKey(f.businessType) ?? parseIndustryKey(head) ?? null;
  return {
    ...base,
    industryKey: industryGuess,
  };
}

/** Maps live dashboard form state into a Bentley snapshot (Revenue OS dashboard ↔ chat / workflow). */
export function bentleySnapshotFromDashboardForm(form: RevenueOsDashboardFormValues): BentleySnapshot {
  const f = normalizeDashboardFormValues(form);
  return {
    industryKey: null,
    contentIndustry: f.businessType,
    targetAudience: f.targetAudience,
    traffic: f.monthlyTraffic,
    conversionRate: f.conversionRatePct,
    aov: f.avgOrderValue,
    businessName: f.businessName,
    coreOffer: f.coreOffer,
    transformation: f.transformation,
    platforms: f.platforms,
    postingPlatforms: dedupePostingPlatforms(f.postingPlatforms ?? []),
    tone: f.tone,
    contentType: f.contentTypeFocus,
    imageStyle: f.imageStyle,
    campaignNotes: f.notes,
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
      : coerceTrimmedString(snap.contentIndustry);
  return {
    businessName: coerceTrimmedString(snap.businessName),
    businessType,
    targetAudience: coerceTrimmedString(snap.targetAudience),
    monthlyTraffic: snap.traffic,
    conversionRatePct: snap.conversionRate,
    avgOrderValue: snap.aov,
    coreOffer: coerceTrimmedString(snap.coreOffer),
    transformation: coerceTrimmedString(snap.transformation),
    platforms: coercePlatformLabelStrings(snap.platforms),
    postingPlatforms: dedupePostingPlatforms(snap.postingPlatforms ?? []),
    tone: coerceTrimmedString(snap.tone),
    contentTypeFocus: coerceTrimmedString(snap.contentType),
    imageStyle: coerceTrimmedString(snap.imageStyle),
    notes: coerceTrimmedString(snap.campaignNotes),
  };
}

function postingPlatformsEqual(a: SocialPlatform[], b: SocialPlatform[]): boolean {
  return JSON.stringify(dedupePostingPlatforms(a)) === JSON.stringify(dedupePostingPlatforms(b));
}

/**
 * Applies only fields that differ so mirror does not churn when snapshot already matches the form.
 *
 * **Traffic / conversion / AOV:** Guided intake treats `0` as “not collected yet”. After a dashboard
 * handoff, `BentleyDashboardMirrorToForm` can run before `BentleyDashboardSharedStateSync` pushes the
 * merged form back into shared state — so we must **not** push snapshot zeros onto a form that already
 * has handoff defaults (e.g. monthly traffic 8000).
 *
 * **Notes:** Do not replace a non-empty dashboard `notes` with an empty snapshot (same stale-snapshot case).
 */
export function dashboardFormPatchFromBentleySnapshotIfDiff(
  snap: BentleySnapshot,
  form: RevenueOsDashboardFormValues
): Partial<RevenueOsDashboardFormValues> {
  const want = dashboardFormPatchFromBentleySnapshot(snap);
  const out: Partial<RevenueOsDashboardFormValues> = {};
  if (want.businessName !== undefined && want.businessName !== form.businessName) out.businessName = want.businessName;
  if (want.businessType !== undefined && want.businessType !== form.businessType) out.businessType = want.businessType;
  if (want.targetAudience !== undefined && want.targetAudience !== form.targetAudience) out.targetAudience = want.targetAudience;
  if (
    snap.traffic > 0 &&
    want.monthlyTraffic !== undefined &&
    want.monthlyTraffic !== form.monthlyTraffic
  ) {
    out.monthlyTraffic = want.monthlyTraffic;
  }
  if (
    snap.conversionRate > 0 &&
    want.conversionRatePct !== undefined &&
    want.conversionRatePct !== form.conversionRatePct
  ) {
    out.conversionRatePct = want.conversionRatePct;
  }
  if (snap.aov > 0 && want.avgOrderValue !== undefined && want.avgOrderValue !== form.avgOrderValue) {
    out.avgOrderValue = want.avgOrderValue;
  }
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
  if (want.notes !== undefined && want.notes !== form.notes) {
    const wantTrim = coerceTrimmedString(want.notes);
    const formTrim = coerceTrimmedString(form.notes);
    if (wantTrim.length > 0 || formTrim.length === 0) {
      out.notes = want.notes;
    }
  }
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
    const mode = env.payload.autoRunMode;
    if (mode != null && !AUTO_RUN_MODES.includes(mode)) {
      delete (env.payload as { autoRunMode?: unknown }).autoRunMode;
    }
    env.payload = normalizeBentleyDashboardHandoffPayload(env.payload);
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
  const n = normalizeBentleyDashboardHandoffPayload(p);
  return (
    (n.businessType.length >= 2 || n.contentIndustry.length >= 2) &&
    n.businessName.length >= 1
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
  const n = normalizeBentleyDashboardHandoffPayload(p);
  const profile = {
    userId: "bentley-validation",
    businessName: n.businessName,
    businessType: n.businessType,
    market: n.market,
    currentMonthlyRevenue: n.currentMonthlyRevenue,
    targetMonthlyRevenue: n.targetMonthlyRevenue,
    avgOrderValue: n.avgOrderValue,
    grossMarginPct: n.grossMarginPct,
    monthlyTraffic: Math.round(n.monthlyTraffic),
    conversionRatePct: n.conversionRatePct,
    cac: n.cac,
    ltv: n.ltv,
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
  const n = normalizeBentleyDashboardHandoffPayload(p);
  return {
    businessName: n.businessName,
    businessType: n.businessType,
    targetAudience: n.targetAudience,
    market: n.market,
    currentMonthlyRevenue: n.currentMonthlyRevenue,
    targetMonthlyRevenue: n.targetMonthlyRevenue,
    avgOrderValue: n.avgOrderValue,
    grossMarginPct: n.grossMarginPct,
    monthlyTraffic: n.monthlyTraffic,
    conversionRatePct: n.conversionRatePct,
    cac: n.cac,
    ltv: n.ltv,
    coreOffer: n.coreOffer,
    transformation: n.transformation,
    platforms: n.platforms,
    postingPlatforms: postingPlatformsFromHandoffPayload(n),
    tone: n.tone,
    contentTypeFocus: n.contentTypeFocus,
    imageStyle: n.imageStyle,
    notes: n.notes,
  };
}
