/**
 * Central provider capabilities for governed social publishing (composer, validation, UI copy).
 * Keep adapter behavior and this module aligned — do not claim support here without an adapter path.
 */

import type { GovernedSocialPublishPlatform } from "@/lib/social/social-governed-platforms";

export type CampaignAssetCreativeType = "IMAGE" | "VIDEO" | "TEXT" | "LINK" | string;

export type ProviderPublishCapabilities = {
  readonly provider: GovernedSocialPublishPlatform;
  /** Plain text / commentary without a campaign asset. */
  readonly supportsTextOnly: boolean;
  readonly supportsLinkUrl: boolean;
  /** If true, scheduled rows need a supported media asset (e.g. Instagram). */
  readonly requiresMediaForScheduledPublish: boolean;
  /** Creative types accepted when a campaign asset is attached (`null` = no extra type gate). */
  readonly allowedMediaCreativeTypes: readonly CampaignAssetCreativeType[] | null;
  /** Implemented in adapter (image URL to Graph). */
  readonly supportsSingleImage: boolean;
  /** Implemented in adapter (video URL + container status polling). */
  readonly supportsSingleVideo: boolean;
  readonly supportsCarousel: boolean;
  /** Media must have `campaign_assets.storage_url` for publish. */
  readonly requiresStorageUrlForMedia: boolean;
};

const LINKEDIN_CAPS: ProviderPublishCapabilities = {
  provider: "linkedin",
  supportsTextOnly: true,
  supportsLinkUrl: true,
  requiresMediaForScheduledPublish: false,
  allowedMediaCreativeTypes: null,
  supportsSingleImage: false,
  supportsSingleVideo: false,
  supportsCarousel: false,
  requiresStorageUrlForMedia: false,
};

const FACEBOOK_CAPS: ProviderPublishCapabilities = {
  provider: "facebook",
  supportsTextOnly: true,
  supportsLinkUrl: true,
  requiresMediaForScheduledPublish: false,
  allowedMediaCreativeTypes: ["IMAGE"],
  supportsSingleImage: true,
  supportsSingleVideo: false,
  supportsCarousel: false,
  requiresStorageUrlForMedia: true,
};

const INSTAGRAM_CAPS: ProviderPublishCapabilities = {
  provider: "instagram",
  supportsTextOnly: false,
  supportsLinkUrl: true,
  requiresMediaForScheduledPublish: true,
  allowedMediaCreativeTypes: ["IMAGE", "VIDEO"],
  supportsSingleImage: true,
  supportsSingleVideo: true,
  supportsCarousel: false,
  requiresStorageUrlForMedia: true,
};

export function getProviderPublishCapabilities(
  platform: string
): ProviderPublishCapabilities | null {
  const p = String(platform || "").trim().toLowerCase();
  if (p === "linkedin") return LINKEDIN_CAPS;
  if (p === "facebook") return FACEBOOK_CAPS;
  if (p === "instagram") return INSTAGRAM_CAPS;
  return null;
}

export function normalizeCampaignCreativeType(raw: string | null | undefined): string {
  return String(raw ?? "").trim().toUpperCase() || "";
}

export function isCreativeTypeAllowedForProviderMedia(
  platform: string,
  creativeType: string | null | undefined
): boolean {
  const caps = getProviderPublishCapabilities(platform);
  if (!caps || !caps.allowedMediaCreativeTypes) return true;
  const t = normalizeCampaignCreativeType(creativeType);
  if (!t) return false;
  return caps.allowedMediaCreativeTypes.some((a) => a.toUpperCase() === t);
}

/** Short string for docs/tooltips. */
export function summarizeProviderMediaCaps(platform: string): string {
  const c = getProviderPublishCapabilities(platform);
  if (!c) return "Unknown provider.";
  const parts: string[] = [];
  if (c.supportsTextOnly) parts.push("text");
  if (c.supportsLinkUrl) parts.push("link");
  if (c.supportsSingleImage) parts.push("image");
  if (c.supportsSingleVideo) parts.push("video");
  if (c.supportsCarousel) parts.push("carousel");
  return parts.length ? parts.join(", ") : "no media modes";
}
