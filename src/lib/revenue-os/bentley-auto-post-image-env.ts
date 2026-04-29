/**
 * Opt-in: Bentley sync-launch may generate and attach `campaign_assets` for new posts.
 * Default off — avoids surprise cost and external calls.
 */
export function readBentleyAutoPostImagesEnv(): boolean {
  const v = (process.env.BENTLEY_AUTO_POST_IMAGES ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
