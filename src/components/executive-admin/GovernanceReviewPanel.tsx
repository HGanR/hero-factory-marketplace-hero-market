"use client";

import type { SmartTrustFulfillmentOrderDetailResultDto } from "@/lib/fulfillment/smart-trust-fulfillment-dtos";

type Props = {
  detail: SmartTrustFulfillmentOrderDetailResultDto;
  busy: boolean;
  onProposeReview: () => void;
  onOpenApproval?: (approvalId: string) => void;
};

export function GovernanceReviewPanel({ detail, busy, onProposeReview, onOpenApproval }: Props) {
  const gr = detail.governanceReview;
  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-950/15 p-3">
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
        Governance review checkpoint
      </h4>
      <p className="mt-1 text-[10px] text-slate-500">
        Trustee workflow: {detail.trusteeWorkflow.label} — round {gr.round}. Advisory only.
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
        <span className="rounded border border-slate-600/50 px-2 py-0.5 text-slate-300">Status: {gr.status}</span>
        {gr.approvalId ? (
          <button
            type="button"
            className="rounded border border-amber-500/40 px-2 py-0.5 text-amber-100/90 hover:bg-amber-950/30"
            onClick={() => onOpenApproval?.(gr.approvalId!)}
          >
            Pending approval
          </button>
        ) : null}
      </div>
      {gr.blockers.length > 0 ? (
        <ul className="mt-2 list-inside list-disc text-[10px] text-rose-200/80">
          {gr.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        disabled={busy || gr.status === "pending"}
        onClick={onProposeReview}
        className="mt-3 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100/90 disabled:opacity-50"
      >
        Propose governance review (approval queue)
      </button>
    </div>
  );
}
