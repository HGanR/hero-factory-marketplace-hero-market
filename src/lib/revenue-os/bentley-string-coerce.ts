import { INDUSTRY_PROFILES, type IndustryKey } from "@/lib/revenue-os/industry-profiles";
import { dedupePostingPlatforms } from "@/lib/revenue-os/bentley-posting-platforms";
import type { BentleyLaunchPrefill, BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import { coercePlatformLabelStrings } from "@/lib/revenue-os/run-revenue-os-analysis";
import type { SocialPlatform } from "@/lib/social/config";
import type { BentleyDashboardHandoffPayload } from "@/lib/revenue-os/bentley-dashboard-types";
import type { BentleyWorkflowArtifacts, BentleyWorkflowState } from "@/lib/revenue-os/bentley-workflow";

/** Safe string for Bentley handoff / snapshot fields (session JSON may store numbers). */
export function coerceTrimmedString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return fallback;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value).trim();
  }
  return fallback;
}

/** Alias — snapshot / form string fields from sessionStorage JSON. */
export function bentleySnapshotStr(value: unknown, fallback = ""): string {
  return coerceTrimmedString(value, fallback);
}

/** Split dashboard `businessType` safely (may be corrupted as number in old session JSON). */
export function dashboardIndustryHead(businessType: unknown): string {
  const bt = coerceTrimmedString(businessType);
  return bt.split("/")[0]?.trim() ?? bt;
}

export function dashboardIndustryOfferType(businessType: unknown): string | undefined {
  const bt = coerceTrimmedString(businessType);
  const tail = bt.split("/")[1]?.trim();
  return tail || undefined;
}

export function coerceFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/,/g, "").trim());
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function coerceIndustryKey(value: unknown): IndustryKey | null {
  const k = coerceTrimmedString(value);
  if (!k) return null;
  return k in INDUSTRY_PROFILES ? (k as IndustryKey) : null;
}

function coercePostingPlatforms(value: unknown): SocialPlatform[] {
  if (!Array.isArray(value)) return [];
  return dedupePostingPlatforms(value.filter((x) => typeof x === "string") as SocialPlatform[]);
}

/** Coerce launch prefill strings from persisted snapshot JSON. */
export function sanitizeBentleyLaunchPrefillFromStorage(raw: unknown): BentleyLaunchPrefill | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const out: BentleyLaunchPrefill = {
    campaignName: coerceTrimmedString(o.campaignName),
    caption: coerceTrimmedString(o.caption),
    hooks: coerceTrimmedString(o.hooks),
    cta: coerceTrimmedString(o.cta),
    platformsLabel: coerceTrimmedString(o.platformsLabel),
  };
  if (
    !out.campaignName &&
    !out.caption &&
    !out.hooks &&
    !out.cta &&
    !out.platformsLabel
  ) {
    return undefined;
  }
  return out;
}

function coerceOptionalWorkflowString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const s = coerceTrimmedString(value);
  return s || null;
}

/** Coerce string artifact fields on workflow state loaded from sessionStorage. */
export function sanitizeBentleyWorkflowStateFromStorage(raw: Partial<BentleyWorkflowState>): BentleyWorkflowState {
  const artifacts: BentleyWorkflowArtifacts = { ...(raw.artifacts ?? {}) };
  if (artifacts.bentleyDbCampaignId !== undefined) {
    artifacts.bentleyDbCampaignId = coerceOptionalWorkflowString(artifacts.bentleyDbCampaignId) ?? null;
  }
  if (artifacts.bentleyLaunchSyncedAt !== undefined) {
    artifacts.bentleyLaunchSyncedAt = coerceOptionalWorkflowString(artifacts.bentleyLaunchSyncedAt) ?? null;
  }
  if (artifacts.campaignPersistenceError !== undefined) {
    artifacts.campaignPersistenceError = coerceOptionalWorkflowString(artifacts.campaignPersistenceError) ?? null;
  }
  if (artifacts.mediaBriefText !== undefined) {
    artifacts.mediaBriefText = coerceOptionalWorkflowString(artifacts.mediaBriefText) ?? null;
  }

  const lastErrorRaw = raw.lastError;
  const lastError =
    lastErrorRaw === undefined
      ? null
      : lastErrorRaw === null
        ? null
        : coerceTrimmedString(lastErrorRaw) || null;

  return {
    currentPhase: raw.currentPhase ?? "intake",
    completed: raw.completed ?? {},
    artifacts,
    lifecycle: raw.lifecycle ?? {},
    lastError,
    lastFailedPhase: raw.lastFailedPhase ?? null,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  } as BentleyWorkflowState;
}

/** Normalize persisted / parsed handoff payload before `.trim()` or schema validation. */
export function normalizeBentleyDashboardHandoffPayload(
  raw: BentleyDashboardHandoffPayload,
): BentleyDashboardHandoffPayload {
  return {
    ...raw,
    businessName: coerceTrimmedString(raw.businessName),
    industryKey: raw.industryKey == null ? null : coerceTrimmedString(raw.industryKey) || null,
    contentIndustry: coerceTrimmedString(raw.contentIndustry),
    businessType: coerceTrimmedString(raw.businessType),
    targetAudience: coerceTrimmedString(raw.targetAudience),
    market: coerceTrimmedString(raw.market, "USA"),
    currentMonthlyRevenue: coerceFiniteNumber(raw.currentMonthlyRevenue),
    targetMonthlyRevenue: coerceFiniteNumber(raw.targetMonthlyRevenue),
    grossMarginPct: coerceFiniteNumber(raw.grossMarginPct),
    monthlyTraffic: coerceFiniteNumber(raw.monthlyTraffic),
    conversionRatePct: coerceFiniteNumber(raw.conversionRatePct),
    avgOrderValue: coerceFiniteNumber(raw.avgOrderValue),
    cac: coerceFiniteNumber(raw.cac),
    ltv: coerceFiniteNumber(raw.ltv),
    coreOffer: coerceTrimmedString(raw.coreOffer),
    transformation: coerceTrimmedString(raw.transformation),
    platforms: coercePlatformLabelStrings(raw.platforms),
    postingPlatforms: coercePostingPlatforms(raw.postingPlatforms),
    tone: coerceTrimmedString(raw.tone),
    contentTypeFocus: coerceTrimmedString(raw.contentTypeFocus),
    imageStyle: coerceTrimmedString(raw.imageStyle),
    notes: coerceTrimmedString(raw.notes),
    autoRunFullAnalysis: Boolean(raw.autoRunFullAnalysis),
    autoRunMode: raw.autoRunMode,
  };
}

/** Normalize canonical snapshot JSON from session/localStorage before applying to React state. */
export function sanitizeBentleySnapshotFromStorage(raw: Partial<BentleySnapshot>): Partial<BentleySnapshot> {
  const out: Partial<BentleySnapshot> = {};
  if ("industryKey" in raw) out.industryKey = coerceIndustryKey(raw.industryKey);
  if ("contentIndustry" in raw) out.contentIndustry = coerceTrimmedString(raw.contentIndustry);
  if ("targetAudience" in raw) out.targetAudience = coerceTrimmedString(raw.targetAudience);
  if ("traffic" in raw) out.traffic = coerceFiniteNumber(raw.traffic);
  if ("conversionRate" in raw) out.conversionRate = coerceFiniteNumber(raw.conversionRate);
  if ("aov" in raw) out.aov = coerceFiniteNumber(raw.aov);
  if ("businessName" in raw) out.businessName = coerceTrimmedString(raw.businessName);
  if ("coreOffer" in raw) out.coreOffer = coerceTrimmedString(raw.coreOffer);
  if ("transformation" in raw) out.transformation = coerceTrimmedString(raw.transformation);
  if ("platforms" in raw) out.platforms = coercePlatformLabelStrings(raw.platforms);
  if ("postingPlatforms" in raw) out.postingPlatforms = coercePostingPlatforms(raw.postingPlatforms);
  if ("tone" in raw) out.tone = coerceTrimmedString(raw.tone, "Professional");
  if ("contentType" in raw) out.contentType = coerceTrimmedString(raw.contentType, "Full Post");
  if ("imageStyle" in raw) out.imageStyle = coerceTrimmedString(raw.imageStyle, "cinematic");
  if ("campaignNotes" in raw) out.campaignNotes = coerceTrimmedString(raw.campaignNotes);
  if ("skipTraffic" in raw) out.skipTraffic = Boolean(raw.skipTraffic);
  if ("skipConversion" in raw) out.skipConversion = Boolean(raw.skipConversion);
  if ("skipAov" in raw) out.skipAov = Boolean(raw.skipAov);
  if ("skipTone" in raw) out.skipTone = Boolean(raw.skipTone);
  if ("skipContentType" in raw) out.skipContentType = Boolean(raw.skipContentType);
  if ("skipImageStyle" in raw) out.skipImageStyle = Boolean(raw.skipImageStyle);
  if ("skipCampaignNotes" in raw) out.skipCampaignNotes = Boolean(raw.skipCampaignNotes);
  if ("optionalAck" in raw && raw.optionalAck && typeof raw.optionalAck === "object") {
    out.optionalAck = raw.optionalAck;
  }
  if ("pipeline" in raw && raw.pipeline && typeof raw.pipeline === "object") {
    out.pipeline = raw.pipeline;
  }
  if ("launchPrefill" in raw) {
    out.launchPrefill = sanitizeBentleyLaunchPrefillFromStorage(raw.launchPrefill);
  }
  return out;
}
