import {
  formatApproveAllBatchPersistentSummary,
  type ApproveAllBatchResult,
} from "@/lib/revenue-os/publish-workflow-approve-all-batch";

/** Production, compact line for the last Approve all run (publish workflow panel). */
export function BulkApproveLastSummaryLine({ batch }: { batch: ApproveAllBatchResult | null }) {
  if (!batch) return null;
  return (
    <p
      role="status"
      data-testid="bulk-approve-last-summary"
      className="mt-2 text-[10px] text-slate-400 border-l-2 border-slate-700 pl-2"
    >
      {formatApproveAllBatchPersistentSummary(batch)}
    </p>
  );
}
