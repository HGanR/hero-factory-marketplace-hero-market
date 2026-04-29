import { getAdapter } from "@/lib/social/adapters";
import { getProviderPublishCapabilities } from "@/lib/social/social-provider-publish-capabilities";
import type { SocialPlatform } from "@/lib/social/config";
import { normalizeAccountPlatformToSocialPlatform } from "@/lib/social/platform-identity";

/**
 * Per-connected-account capability model for UI + composer gates.
 * Derived from real adapter presence + `social-provider-publish-capabilities` (no fake “post anywhere”).
 */
export type SocialAccountCapabilityFlags = {
  canPublishText: boolean;
  canPublishImage: boolean;
  canPublishCarousel: boolean;
  canPublishVideo: boolean;
  canSchedule: boolean;
  canReadComments: boolean;
  canReplyComments: boolean;
  canReadDMs: boolean;
  canSendDMs: boolean;
  canFetchAnalytics: boolean;
};

const UNSUPPORTED: SocialAccountCapabilityFlags = {
  canPublishText: false,
  canPublishImage: false,
  canPublishCarousel: false,
  canPublishVideo: false,
  canSchedule: false,
  canReadComments: false,
  canReplyComments: false,
  canReadDMs: false,
  canSendDMs: false,
  canFetchAnalytics: false,
};

function baseFlagsForImplementedOrganicPublish(platform: SocialPlatform): SocialAccountCapabilityFlags {
  const adapter = getAdapter(platform);
  if (!adapter) {
    return { ...UNSUPPORTED };
  }
  const caps = getProviderPublishCapabilities(platform);
  if (!caps) {
    return { ...UNSUPPORTED };
  }
  return {
    canPublishText: caps.supportsTextOnly,
    canPublishImage: caps.supportsSingleImage,
    canPublishVideo: caps.supportsSingleVideo,
    canPublishCarousel: caps.supportsCarousel,
    /** Scheduling is modelled in-app via `campaign_posts.scheduled_at` + worker; not all providers expose native schedule APIs — we only claim true when we have an adapter. */
    canSchedule: true,
    canReadComments: false,
    canReplyComments: false,
    canReadDMs: false,
    canSendDMs: false,
    canFetchAnalytics: true,
  };
}

/**
 * Public capability view for a connected account row (merge DB overrides + derived defaults).
 */
export function deriveSocialAccountCapabilityFlags(
  platform: string,
  overrides: Partial<SocialAccountCapabilityFlags> | null | undefined
): {
  platform: string;
  flags: SocialAccountCapabilityFlags;
  directOrganicPublishAvailable: boolean;
  notes: string[];
} {
  const p = normalizeAccountPlatformToSocialPlatform(platform);
  const notes: string[] = [];
  if (!p) {
    const flags = { ...UNSUPPORTED, ...stripUndefined(overrides) };
    notes.push("Unknown or unsupported platform id — use manual export only.");
    return { platform: String(platform || ""), flags, directOrganicPublishAvailable: false, notes };
  }
  const base = baseFlagsForImplementedOrganicPublish(p);
  const directOrganicPublishAvailable =
    base.canPublishText || base.canPublishImage || base.canPublishVideo;

  if (!directOrganicPublishAvailable) {
    notes.push("Direct organic publishing is not implemented for this platform in-app — use export / manual posting.");
  }
  if (base.canPublishImage || base.canPublishVideo) {
    const caps = getProviderPublishCapabilities(p);
    if (caps?.requiresStorageUrlForMedia) {
      notes.push("Media posts require a hosted asset URL (upload/IPFS) before the network can accept the post.");
    }
  }

  const flags: SocialAccountCapabilityFlags = { ...base, ...stripUndefined(overrides) };
  return { platform, flags, directOrganicPublishAvailable, notes };
}

function stripUndefined<T extends Record<string, unknown>>(o: Partial<T> | null | undefined): Partial<T> {
  if (!o) return {};
  const out: Partial<T> = {};
  for (const k of Object.keys(o) as (keyof T)[]) {
    if (o[k] !== undefined) out[k] = o[k]!;
  }
  return out;
}
