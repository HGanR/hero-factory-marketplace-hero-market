/**
 * Paid social campaign draft readiness (Parts 48–49).
 * Structural completeness + Meta launch eligibility when `PAID_SOCIAL_META_ADS_EXECUTION_ENABLED` is on.
 */

import { isMetaAdsLaunchFeatureEnabled } from "@/lib/social/paid-social-meta-execution-flag";

export const PAID_SOCIAL_AD_PROVIDERS = ["meta_ads"] as const;
export type PaidSocialAdProvider = (typeof PAID_SOCIAL_AD_PROVIDERS)[number];

export function isPaidSocialAdProvider(v: string): v is PaidSocialAdProvider {
  return (PAID_SOCIAL_AD_PROVIDERS as readonly string[]).includes(v);
}

/** True when provider has a shipped execution path **and** the Meta launch feature flag is enabled. */
export function isPaidSocialProviderLaunchImplemented(provider: string): boolean {
  if (provider !== "meta_ads") return false;
  return isMetaAdsLaunchFeatureEnabled();
}

/** Operator-facing label. */
export function paidSocialProviderDisplayLabel(provider: string): string {
  if (provider === "meta_ads") {
    if (isMetaAdsLaunchFeatureEnabled()) {
      return "Meta ads (Facebook & Instagram) — narrow launch path (traffic/engagement, single image); enable only when env flag is set.";
    }
    return "Meta ads (Facebook & Instagram) — planning drafts; launch disabled (set PAID_SOCIAL_META_ADS_EXECUTION_ENABLED).";
  }
  return provider;
}

export type PaidSocialPlacementId =
  | "facebook_feed"
  | "instagram_feed"
  | "instagram_reels"
  | "facebook_reels"
  | "instagram_stories"
  | "facebook_stories";

export const PAID_SOCIAL_PLACEMENT_IDS: readonly PaidSocialPlacementId[] = [
  "facebook_feed",
  "instagram_feed",
  "instagram_reels",
  "facebook_reels",
  "instagram_stories",
  "facebook_stories",
] as const;

export type PaidSocialAudienceSummary = {
  geography?: string;
  ageMin?: number;
  ageMax?: number;
  interestsNotes?: string;
  customAudiencePlaceholder?: string;
};

export type PaidSocialCreativeConfig = {
  /** `campaign_assets.id` */
  primaryAssetIds?: string[];
  /** Optional governed organic post for creative alignment. */
  referenceOrganicPostId?: string | null;
  notes?: string;
};

export type PaidSocialDraftBlockedReasonCode =
  | "missing_objective"
  | "missing_budget"
  | "missing_destination"
  | "missing_placements"
  | "missing_creative"
  | "provider_not_launchable_yet"
  | "meta_ads_launch_feature_disabled"
  | "missing_meta_ad_account"
  | "missing_meta_page_id"
  | "unsupported_objective_for_meta_launch"
  | "unsupported_creative_for_meta_launch"
  | "unsupported_placements_for_meta_launch"
  | "already_launched"
  | "launch_in_progress";

export type PaidSocialCampaignReadiness = {
  structurallyComplete: boolean;
  structurallyBlockedReasons: PaidSocialDraftBlockedReasonCode[];
  /** True when the operator may call the launch API for this draft (flag on, subset supported, linkage ok, not already launched). */
  launchEligible: boolean;
  launchBlockedReasons: PaidSocialDraftBlockedReasonCode[];
  nextActionHints: string[];
  /** Overlay for remote execution state (independent of structural draft). */
  metaExecutionOverlay: "none" | "launching" | "launched" | "failed";
};

export type PaidSocialMetaExecutionReadinessInput = {
  metaAdAccountId: string | null;
  metaPageId: string | null;
  metaLaunchStatus: string;
  remoteMetaCampaignId: string | null;
  /** First linked asset: creative_type uppercased e.g. IMAGE, or null. */
  primaryAssetCreativeType: string | null;
  /** Whether first linked asset has a non-empty storage_url (Meta must fetch the URL). */
  primaryAssetHasPublicImageUrl: boolean;
};

function dedupeStrings(a: string[]): string[] {
  return Array.from(new Set(a));
}

function normalizePlacements(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim());
}

function normalizeCreative(raw: unknown): PaidSocialCreativeConfig {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const ids = o.primaryAssetIds;
  const primaryAssetIds =
    Array.isArray(ids) && ids.every((x) => typeof x === "string")
      ? (ids as string[]).map((x) => x.trim()).filter(Boolean)
      : undefined;
  const ref = o.referenceOrganicPostId;
  const referenceOrganicPostId =
    typeof ref === "string" && ref.trim() ? ref.trim() : ref === null ? null : undefined;
  const notes = typeof o.notes === "string" ? o.notes : undefined;
  return { primaryAssetIds, referenceOrganicPostId, notes };
}

/** v1 Meta launch: traffic + engagement only. */
export function isObjectiveSupportedForMetaLaunchV1(objective: string): boolean {
  const o = objective.trim().toLowerCase();
  return o === "traffic" || o === "engagement";
}

/**
 * Returns true if placements map to at least one Meta publisher position (v1).
 */
export function metaLaunchV1PlacementSupported(placements: string[]): boolean {
  const p = new Set(placements);
  return (
    p.has("facebook_feed") ||
    p.has("instagram_feed") ||
    p.has("instagram_reels") ||
    p.has("facebook_reels") ||
    p.has("instagram_stories") ||
    p.has("facebook_stories")
  );
}

export function derivePaidSocialCampaignReadiness(args: {
  provider: string;
  objective: string;
  budgetType: string;
  budgetAmountMinor: number | null;
  destinationUrl: string | null;
  placements: unknown;
  creative: unknown;
  /** When set, applies Part 49 Meta-specific launch rules (after structural checks). */
  metaExecution?: PaidSocialMetaExecutionReadinessInput;
}): PaidSocialCampaignReadiness {
  const structurallyBlockedReasons: PaidSocialDraftBlockedReasonCode[] = [];
  const hints: string[] = [];

  const obj = (args.objective ?? "").trim();
  if (!obj) {
    structurallyBlockedReasons.push("missing_objective");
    hints.push("Choose an objective: awareness, traffic, engagement, leads, or conversions.");
  }

  const bt = String(args.budgetType || "none").toLowerCase();
  if (bt === "none" || args.budgetAmountMinor == null || args.budgetAmountMinor <= 0) {
    structurallyBlockedReasons.push("missing_budget");
    hints.push("Set budget type (daily or lifetime) and a positive amount (minor units, e.g. cents).");
  }

  const dest = (args.destinationUrl ?? "").trim();
  if (!dest) {
    structurallyBlockedReasons.push("missing_destination");
    hints.push("Add a destination URL (landing page).");
  } else {
    try {
      const u = new URL(dest);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        structurallyBlockedReasons.push("missing_destination");
        hints.push("Destination URL must use http or https.");
      }
    } catch {
      structurallyBlockedReasons.push("missing_destination");
      hints.push("Enter a valid http(s) URL for the destination.");
    }
  }

  const pl = normalizePlacements(args.placements);
  if (pl.length === 0) {
    structurallyBlockedReasons.push("missing_placements");
    hints.push("Pick at least one placement (feed, reels, or stories).");
  }

  const cr = normalizeCreative(args.creative);
  const hasAsset = (cr.primaryAssetIds?.length ?? 0) > 0;
  const hasRefPost = Boolean(cr.referenceOrganicPostId?.trim());
  if (!hasAsset && !hasRefPost) {
    structurallyBlockedReasons.push("missing_creative");
    hints.push("Link at least one campaign asset or reference a governed organic post for creative context.");
  }

  const structurallyComplete = structurallyBlockedReasons.length === 0;

  const launchBlockedReasons: PaidSocialDraftBlockedReasonCode[] = [...structurallyBlockedReasons];
  let metaExecutionOverlay: PaidSocialCampaignReadiness["metaExecutionOverlay"] = "none";

  const mx = args.metaExecution;

  if (args.provider === "meta_ads" && !isMetaAdsLaunchFeatureEnabled()) {
    launchBlockedReasons.push("meta_ads_launch_feature_disabled");
    hints.push("Set PAID_SOCIAL_META_ADS_EXECUTION_ENABLED to enable Meta launch in this environment.");
  } else if (args.provider !== "meta_ads" && !isPaidSocialProviderLaunchImplemented(args.provider)) {
    launchBlockedReasons.push("provider_not_launchable_yet");
    hints.push("Paid ad launch is not available for this provider in this deployment.");
  }

  if (mx && args.provider === "meta_ads") {
    const st = (mx.metaLaunchStatus || "idle").toLowerCase();
    if (st === "launching") {
      metaExecutionOverlay = "launching";
      launchBlockedReasons.push("launch_in_progress");
      hints.push("A launch is already in progress for this draft.");
    } else if (st === "launched" || (mx.remoteMetaCampaignId && mx.remoteMetaCampaignId.trim() !== "")) {
      metaExecutionOverlay = "launched";
      launchBlockedReasons.push("already_launched");
      hints.push("This draft already has a Meta campaign — do not relaunch from the UI (avoid duplicate ads).");
    } else if (st === "failed") {
      metaExecutionOverlay = "failed";
    }

    if (
      isMetaAdsLaunchFeatureEnabled() &&
      structurallyComplete &&
      metaExecutionOverlay !== "launching" &&
      metaExecutionOverlay !== "launched"
    ) {
      const acct = (mx.metaAdAccountId ?? "").replace(/^act_/i, "").trim();
      if (!acct) {
        launchBlockedReasons.push("missing_meta_ad_account");
        hints.push("Enter the Meta ad account id (digits or act_…) for this draft.");
      }
      const page = (mx.metaPageId ?? "").trim();
      if (!page) {
        launchBlockedReasons.push("missing_meta_page_id");
        hints.push("Enter the Facebook Page id used for ad creatives (required by Meta object_story_spec).");
      }
      if (!isObjectiveSupportedForMetaLaunchV1(args.objective)) {
        launchBlockedReasons.push("unsupported_objective_for_meta_launch");
        hints.push("v1 Meta launch supports objectives traffic and engagement only.");
      }
      const ct = (mx.primaryAssetCreativeType ?? "").toUpperCase();
      if (ct !== "IMAGE" || !mx.primaryAssetHasPublicImageUrl) {
        launchBlockedReasons.push("unsupported_creative_for_meta_launch");
        hints.push("v1 Meta launch requires a single IMAGE campaign asset with a storage URL Meta can fetch.");
      }
      if (!metaLaunchV1PlacementSupported(pl)) {
        launchBlockedReasons.push("unsupported_placements_for_meta_launch");
        hints.push("Adjust placements — v1 expects at least one standard feed/reels/stories placement.");
      }
    }
  }

  const effectiveLaunchBlocked = dedupeStrings(launchBlockedReasons) as PaidSocialDraftBlockedReasonCode[];

  const launchEligible =
    structurallyComplete &&
    args.provider === "meta_ads" &&
    isMetaAdsLaunchFeatureEnabled() &&
    !!mx &&
    metaExecutionOverlay !== "launching" &&
    metaExecutionOverlay !== "launched" &&
    (mx.metaAdAccountId ?? "").replace(/^act_/i, "").trim() !== "" &&
    (mx.metaPageId ?? "").trim() !== "" &&
    isObjectiveSupportedForMetaLaunchV1(args.objective) &&
    (mx.primaryAssetCreativeType ?? "").toUpperCase() === "IMAGE" &&
    mx.primaryAssetHasPublicImageUrl &&
    metaLaunchV1PlacementSupported(pl);

  return {
    structurallyComplete,
    structurallyBlockedReasons,
    launchEligible,
    launchBlockedReasons: effectiveLaunchBlocked,
    nextActionHints: dedupeStrings(hints),
    metaExecutionOverlay,
  };
}
