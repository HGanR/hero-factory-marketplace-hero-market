"use client";

import type { RevenueOsFulfillmentOrderDetailResultDto } from "@/lib/fulfillment/revenue-os-fulfillment-dtos";

type Props = {
  detail: RevenueOsFulfillmentOrderDetailResultDto;
  busy: boolean;
  onProposeReview: () => void;
  onOpenApproval?: (approvalId: string) => void;
};

export function CampaignReviewPanel({ detail, busy, onProposeReview, onOpenApproval }: Props) {
  const cr = detail.campaignReview;
  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-950/15 p-3">
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200/80">
        Campaign review packet
      </h4>
      <p className="mt-1 text-[10px] text-slate-500">
        Draft review workflow — revision round {cr.revisionRound}. No autonomous publish.
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
        <span className="rounded border border-slate-600/50 px-2 py-0.5 text-slate-300">Status: {cr.status}</span>
        {cr.approvalId ? (
          <button
            type="button"
            className="rounded border border-amber-500/40 px-2 py-0.5 text-amber-100/90 hover:bg-amber-950/30"
            onClick={() => onOpenApproval?.(cr.approvalId!)}
          >
            Pending approval
          </button>
        ) : null}
      </div>
      {cr.packetPreview ? (
        <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-700/50 bg-slate-950/50 p-2 text-[10px] text-slate-400">
          {cr.packetPreview}
        </pre>
      ) : (
        <p className="mt-2 text-[10px] text-slate-500">Link a campaign on the order handoff to preview intake.</p>
      )}
      <button
        type="button"
        disabled={busy || cr.status === "proposed"}
        onClick={onProposeReview}
        className="mt-3 rounded-lg border border-violet-500/40 bg-violet-950/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-100/90 disabled:opacity-50"
      >
        Propose campaign review (approval queue)
      </button>
    </div>
  );
}
