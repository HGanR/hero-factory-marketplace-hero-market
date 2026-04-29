/**
 * Platforms supported for governed Revenue OS social posts (`campaign_posts.platform`).
 * Single allow-list for planner, POST /api/social/posts, and account matching.
 */
export const GOVERNED_SOCIAL_PUBLISH_PLATFORMS = ["linkedin", "facebook", "instagram"] as const;

export type GovernedSocialPublishPlatform = (typeof GOVERNED_SOCIAL_PUBLISH_PLATFORMS)[number];

export function isGovernedSocialPublishPlatform(p: string): p is GovernedSocialPublishPlatform {
  return (GOVERNED_SOCIAL_PUBLISH_PLATFORMS as readonly string[]).includes(p);
}

export function defaultSocialAccountLabelForPlatform(platform: string): string {
  const s = platform.trim().toLowerCase();
  if (s === "linkedin") return "LinkedIn";
  if (s === "facebook") return "Facebook";
  if (s === "instagram") return "Instagram";
  return s || "Social";
}
