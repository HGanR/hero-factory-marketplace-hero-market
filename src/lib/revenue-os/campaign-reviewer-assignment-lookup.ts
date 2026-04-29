/**
 * Query parsing + API mapping for campaign reviewer user lookup (owner/admin only).
 */

export const REVIEWER_LOOKUP_Q_MIN_LEN = 2;
export const REVIEWER_LOOKUP_Q_MAX_LEN = 64;
export const REVIEWER_LOOKUP_LIMIT_DEFAULT = 8;
export const REVIEWER_LOOKUP_LIMIT_MIN = 5;
export const REVIEWER_LOOKUP_LIMIT_MAX = 10;

export type ReviewerLookupCandidateApi = {
  userId: number;
  displayName: string;
  email: string;
};

/** Returns trimmed query or null if lookup should return no candidates (no HTTP error). */
export function normalizeReviewerLookupQuery(raw: string | null): string | null {
  let q = String(raw ?? "").trim();
  if (!q) return null;
  q = q.replace(/[%_\\]/g, "");
  if (q.length < REVIEWER_LOOKUP_Q_MIN_LEN) return null;
  if (q.length > REVIEWER_LOOKUP_Q_MAX_LEN) return null;
  return q;
}

export function parseReviewerLookupLimit(param: string | null): number {
  if (param == null || param === "") return REVIEWER_LOOKUP_LIMIT_DEFAULT;
  const n = parseInt(param, 10);
  if (!Number.isFinite(n)) return REVIEWER_LOOKUP_LIMIT_DEFAULT;
  return Math.min(
    REVIEWER_LOOKUP_LIMIT_MAX,
    Math.max(REVIEWER_LOOKUP_LIMIT_MIN, n)
  );
}

export function mapMarketplaceRowToReviewerLookupCandidate(row: {
  id: number;
  username: string;
  email: string;
}): ReviewerLookupCandidateApi {
  return {
    userId: row.id,
    displayName: row.username.slice(0, 100),
    email: row.email.slice(0, 320),
  };
}
