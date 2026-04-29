/**
 * Feature gate for Meta Marketing API launch (Part 49).
 * Documented env: `PAID_SOCIAL_META_ADS_EXECUTION_ENABLED` = `1` | `true` | `yes` (case-insensitive).
 */

export const PAID_SOCIAL_META_ADS_EXECUTION_ENV = "PAID_SOCIAL_META_ADS_EXECUTION_ENABLED" as const;

export function isMetaAdsLaunchFeatureEnabled(): boolean {
  const v = process.env[PAID_SOCIAL_META_ADS_EXECUTION_ENV]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
