/**
 * Canonical TypeScript contracts for paid-campaign API JSON (Part 77).
 * Single source of truth for list vs single-item success payloads and loose fetch() parsing.
 * Runtime payloads are unchanged.
 *
 * Revenue OS client code may import the shared fetch/hydration surface from
 * `@/components/revenue-os/paid-campaign` (Part 81); routes stay on this module directly.
 */
import type { OrganicPromotionOpportunitySummary } from "@/lib/social/organic-performance-signals";
import type { SyncPaidSocialMetaResult } from "@/lib/social/paid-social-campaign-meta-sync";
import type { PaidSocialCampaignRollup } from "@/lib/social/paid-social-campaign-paid-rollup";
import type { PaidListSignalsSummary } from "@/lib/social/paid-social-optimization-signals";
import type { PaidSocialCampaignPublic, PromotionDecisionSummary } from "@/lib/social/paid-social-campaigns";

/** Successful single paid draft: GET/PATCH :id, POST create, from-post, launch, and the core of sync before `sync` extras. */
export type PaidCampaignSuccessResponse<
  TPaid extends PaidSocialCampaignPublic = PaidSocialCampaignPublic,
> = {
  ok: true;
  paidCampaign: TPaid;
  promotionDecisionSummary?: PromotionDecisionSummary;
};

/** GET /api/social/paid-campaigns?campaignId= */
export type PaidCampaignListSuccessResponse = {
  ok: true;
  paidCampaigns: PaidSocialCampaignPublic[];
  paidRollup: PaidSocialCampaignRollup | null;
  paidListSignalsSummary: PaidListSignalsSummary;
  organicPromotionOpportunitySummary: OrganicPromotionOpportunitySummary;
  promotionDecisionSummary?: PromotionDecisionSummary;
};

/** Loose `fetch().json()` for the list route (tests may omit fields). */
export type PaidCampaignListFetchJson = {
  ok?: boolean;
  error?: string;
  paidCampaigns?: PaidSocialCampaignPublic[];
  paidRollup?: PaidSocialCampaignRollup | null;
  paidListSignalsSummary?: PaidListSignalsSummary;
  organicPromotionOpportunitySummary?: OrganicPromotionOpportunitySummary;
  promotionDecisionSummary?: PromotionDecisionSummary;
};

/**
 * Subset of single-item API JSON used before client normalization (optional fields for partial JSON).
 * Normalized state: `PaidCampaignHydration` in `@/components/revenue-os/paid-campaign-hydration`.
 */
export type PaidCampaignHydrationJsonInput<TPaid = unknown> = {
  paidCampaign?: TPaid;
  promotionDecisionSummary?: PromotionDecisionSummary;
};

/**
 * Loose `fetch().json()` for single-item routes (mutations, detail, sync summary): hydration fields plus
 * common transport/error keys and occasional extras (`details`, from-post `existingName`, sync `warningCount`).
 */
export type PaidCampaignFetchJson<TPaid = unknown> = PaidCampaignHydrationJsonInput<TPaid> & {
  ok?: boolean;
  error?: string;
  message?: string;
  details?: unknown;
  existingName?: string;
  sync?: { warningCount?: number };
};

/** GET /api/social/paid-campaigns/:id/sync — service bundle plus optional campaign rollup. */
export type PaidCampaignSuccessWithSyncResponse = SyncPaidSocialMetaResult & {
  promotionDecisionSummary?: PromotionDecisionSummary;
};
