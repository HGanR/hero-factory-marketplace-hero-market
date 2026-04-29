/**
 * Public social surface router — delegates by platform; generic HTML fetch as fallback.
 * Analysis-only; no authenticated scraping.
 */

import { fetchGenericPublicSocialSurface } from "./fetchGenericPublicSocialSurface";
import { fetchInstagramPublicSurface } from "./fetchInstagramPublicSurface";
import { fetchRedditPublicSurface } from "./fetchRedditPublicSurface";
import { fetchTikTokPublicSurface } from "./fetchTikTokPublicSurface";
import { fetchYouTubePublicSurface } from "./fetchYouTubePublicSurface";
import { detectSocialPlatform } from "./socialPlatformRouter";
import type { PublicSocialSurface } from "./types";

export async function fetchPublicSocialSurface(
  profileUrl: string | null | undefined
): Promise<PublicSocialSurface> {
  if (!profileUrl?.trim()) {
    return fetchGenericPublicSocialSurface(profileUrl);
  }

  const platform = detectSocialPlatform(profileUrl);
  switch (platform) {
    case "instagram":
      return fetchInstagramPublicSurface(profileUrl);
    case "tiktok":
      return fetchTikTokPublicSurface(profileUrl);
    case "youtube":
      return fetchYouTubePublicSurface(profileUrl);
    case "reddit":
      return fetchRedditPublicSurface(profileUrl);
    default:
      return fetchGenericPublicSocialSurface(profileUrl);
  }
}
