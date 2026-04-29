/**
 * Detects posts created or promoted from Social Studio (governed `campaign_posts.utmParams`).
 * Single source of truth for planner / dashboard chips (no new columns).
 */
export function isFromSocialStudioUtm(utm: Record<string, string>): boolean {
  if (utm.from_social_studio === "1" || utm.social_studio_source === "1") return true;
  if (String(utm.social_studio_run_id || "").trim().length > 0) return true;
  return false;
}
