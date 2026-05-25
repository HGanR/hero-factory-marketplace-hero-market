"use client";

import type { StaleRecoveryDebugSummary } from "@/lib/revenue-os/stale-review-recovery";

export function PublishWorkflowStaleRecoveryDebug(props: {
  summary: StaleRecoveryDebugSummary | null;
}) {
  if (!props.summary) return null;
  return (
    <div className="mt-2 rounded border border-amber-900/40 bg-amber-950/20 p-2 text-[11px] text-amber-100/90">
      <div className="font-semibold text-amber-200/90">Stale recovery (debug)</div>
      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap">{JSON.stringify(props.summary, null, 2)}</pre>
    </div>
  );
}
