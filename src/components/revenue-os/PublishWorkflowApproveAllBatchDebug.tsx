import type { ApproveAllBatchResult } from "@/lib/revenue-os/publish-workflow-approve-all-batch";

export function PublishWorkflowApproveAllBatchDebug({ batch }: { batch: ApproveAllBatchResult | null }) {
  if (!batch) {
    return <div data-testid="approve-all-batch-debug">last approve-all batch: —</div>;
  }
  return (
    <div
      data-testid="approve-all-batch-debug"
      className="space-y-0.5 border-t border-slate-800 pt-1 mt-1 text-slate-400 break-all"
    >
      <div className="text-slate-500">last approve-all batch</div>
      <div data-testid="approve-all-attempted">attemptedCount: {batch.attemptedCount}</div>
      <div data-testid="approve-all-succeeded">succeededCount: {batch.succeededCount}</div>
      <div data-testid="approve-all-idempotent">idempotentCount: {batch.idempotentCount}</div>
      <div data-testid="approve-all-stale-at">staleStoppedAtPostId: {batch.staleStoppedAtPostId ?? "—"}</div>
      <div data-testid="approve-all-remaining">remainingCount: {batch.remainingCount}</div>
      <div data-testid="approve-all-fresh-ids">freshIds: {batch.freshApprovedPostIds.join(", ") || "—"}</div>
      <div data-testid="approve-all-idem-ids">idempotentIds: {batch.idempotentPostIds.join(", ") || "—"}</div>
    </div>
  );
}
