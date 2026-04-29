/**
 * Deterministic idempotency string (not a DB id). Useful for cross-provider log correlation.
 * Primary uniqueness remains (`social_account_id`, `external_thread_id`) in `social_engagement_threads`.
 */
export function buildSocialEngagementThreadDedupeKey(socialAccountId: string, externalThreadId: string): string {
  return `${String(socialAccountId).trim()}::${String(externalThreadId).trim()}`;
}
