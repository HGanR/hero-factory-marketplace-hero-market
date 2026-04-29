import type { PublishApprovalAuditRecentApiEvent } from "@/lib/revenue-os/publish-approval-audit";

/** Normalizes fetch outcome for workflow panel state (debug-only audit list). */
export function approvalAuditEventsAfterRefresh(
  debug: boolean,
  fetched: PublishApprovalAuditRecentApiEvent[] | null | undefined
): PublishApprovalAuditRecentApiEvent[] {
  if (!debug) return [];
  return Array.isArray(fetched) ? fetched : [];
}
