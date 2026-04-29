import type { PublishApprovalAnalyticsSummary } from "@/lib/revenue-os/publish-approval-analytics";

/** Human-readable lines for compact owner/admin analytics UI (testable). */
export function formatOldestPendingAgeShort(summary: PublishApprovalAnalyticsSummary): string {
  const ms = summary.oldestPendingStepAgeMs;
  if (ms == null) return "—";
  const h = Math.floor(ms / 3600000);
  if (h < 72) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function formatAveragePendingAgeShort(summary: PublishApprovalAnalyticsSummary): string {
  const ms = summary.averagePendingStepAgeMs;
  if (ms == null) return "—";
  const h = Math.floor(ms / 3600000);
  if (h < 72) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function formatRoleBreakdownCompact(byRole: Record<string, number>): string {
  const parts = Object.entries(byRole)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k}:${n}`);
  return parts.length ? parts.join(" · ") : "—";
}

export function formatStepBreakdownCompact(byStepIndex: Record<string, number>): string {
  const parts = Object.entries(byStepIndex)
    .filter(([, n]) => n > 0)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([step, n]) => `s${Number(step) + 1}:${n}`);
  return parts.length ? parts.join(" · ") : "—";
}
