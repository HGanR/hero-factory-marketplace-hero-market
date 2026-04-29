/**
 * Shared rules for POST/PATCH governed social posts — no DB queries inside validators.
 */

import {
  getProviderPublishCapabilities,
  isCreativeTypeAllowedForProviderMedia,
  normalizeCampaignCreativeType,
} from "@/lib/social/social-provider-publish-capabilities";

export const INSTAGRAM_SCHEDULE_REQUIRES_ASSET_MESSAGE =
  "Instagram scheduled posts need a campaign image or video asset with a public storage URL. The Content Publishing API cannot publish text-only or link-only posts.";

export type SocialPostMediaValidationCode =
  | "INSTAGRAM_REQUIRES_MEDIA"
  | "PROVIDER_MEDIA_UNSUPPORTED_TYPE"
  | "MEDIA_ASSET_MISSING_URL"
  | "FACEBOOK_VIDEO_NOT_SUPPORTED";

export function instagramScheduledPostRequiresAsset(args: {
  provider: string;
  scheduledFor?: string | null;
  assetId?: string | null;
}): boolean {
  if (String(args.provider).toLowerCase() !== "instagram") return false;
  if (!args.scheduledFor?.trim()) return false;
  return !args.assetId?.trim();
}

export function validateComposerSocialPostMedia(args: {
  provider: string;
  scheduledFor?: string | null;
  assetId?: string | null;
  assetCreativeType?: string | null;
  hasStorageUrl?: boolean;
}):
  | { ok: true }
  | { ok: false; code: SocialPostMediaValidationCode; message: string } {
  const provider = String(args.provider || "").toLowerCase();
  const caps = getProviderPublishCapabilities(provider);
  const scheduled = Boolean(args.scheduledFor?.trim());
  const assetId = args.assetId?.trim() || null;
  const creative = assetId ? normalizeCampaignCreativeType(args.assetCreativeType) : "";
  const hasUrl = args.hasStorageUrl === true;

  if (!caps) {
    return { ok: true };
  }

  if (provider === "instagram" && scheduled && !assetId) {
    return { ok: false, code: "INSTAGRAM_REQUIRES_MEDIA", message: INSTAGRAM_SCHEDULE_REQUIRES_ASSET_MESSAGE };
  }

  if (assetId && caps.allowedMediaCreativeTypes) {
    if (!creative) {
      return {
        ok: false,
        code: "PROVIDER_MEDIA_UNSUPPORTED_TYPE",
        message: "Campaign asset type is missing — cannot validate media for this provider.",
      };
    }
    if (!isCreativeTypeAllowedForProviderMedia(provider, creative)) {
      if (provider === "facebook" && creative === "VIDEO") {
        return {
          ok: false,
          code: "FACEBOOK_VIDEO_NOT_SUPPORTED",
          message:
            "Facebook Page publishing in Revenue OS supports optional IMAGE attachments only; video is not implemented yet.",
        };
      }
      return {
        ok: false,
        code: "PROVIDER_MEDIA_UNSUPPORTED_TYPE",
        message:
          provider === "instagram"
            ? "Instagram posts need a campaign IMAGE or VIDEO asset. TEXT/LINK creative types cannot be published via the Content Publishing API."
            : `This provider does not support campaign assets of type ${creative} for publishing.`,
      };
    }
    if (caps.requiresStorageUrlForMedia && !hasUrl) {
      return {
        ok: false,
        code: "MEDIA_ASSET_MISSING_URL",
        message: "This campaign asset has no storage URL — upload or fix the asset before using it on a social post.",
      };
    }
  }

  return { ok: true };
}
