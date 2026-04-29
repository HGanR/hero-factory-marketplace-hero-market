/**
 * Shared query parsing for GET /api/revenue-os/approval-audit-recent.
 */

export function parseApprovalAuditRecentQueryParams(sp: URLSearchParams): {
  limit: number;
  postId: string;
  platform: string;
} {
  const limitRaw = parseInt(sp.get("limit") ?? "5", 10);
  const limit = Math.min(25, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 5));
  const postId = sp.get("postId")?.trim() ?? "";
  const platform = (sp.get("platform")?.trim() ?? "").slice(0, 24);
  return { limit, postId, platform };
}

/**
 * Mirrors `approval-audit-recent/route.ts` where-branching (for tests).
 * If the route gains filters, update this helper and its spec.
 */
export function countApprovalAuditWhereClauses(filters: { postId: string; platform: string }): number {
  let c = 2;
  if (filters.postId) c++;
  if (filters.platform) c++;
  return c;
}
