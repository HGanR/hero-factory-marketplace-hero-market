/**
 * Debug-only helpers for publish approval audit fetch (Bentley workflow review panel).
 */

const APPROVAL_AUDIT_PATH = "/api/revenue-os/approval-audit-recent";

/**
 * When exactly one workflow row exists, narrow audit fetch to that post (and platform)
 * for less noise in multi-campaign debug views.
 */
export function narrowPublishWorkflowDebugAuditFilters(
  rows: { id: string; platform?: string }[] | null | undefined
): { postId?: string; platform?: string } {
  if (!rows || rows.length !== 1) return {};
  const r = rows[0];
  const postId = r.id?.trim() || undefined;
  const platform = r.platform?.trim().slice(0, 24) || undefined;
  return {
    ...(postId ? { postId } : {}),
    ...(platform ? { platform } : {}),
  };
}

export function buildPublishWorkflowDebugApprovalAuditUrl(args: {
  limit: number;
  postId?: string | null;
  platform?: string | null;
}): string {
  const u = new URL(APPROVAL_AUDIT_PATH, "http://_");
  u.searchParams.set("limit", String(args.limit));
  const pid = args.postId?.trim();
  if (pid) u.searchParams.set("postId", pid);
  const plat = (args.platform?.trim() ?? "").slice(0, 24);
  if (plat) u.searchParams.set("platform", plat);
  return `${u.pathname}${u.search}`;
}
