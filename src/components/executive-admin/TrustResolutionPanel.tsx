"use client";

import { useState } from "react";
import type { SmartTrustFulfillmentOrderDetailResultDto } from "@/lib/fulfillment/smart-trust-fulfillment-dtos";

type Props = {
  detail: SmartTrustFulfillmentOrderDetailResultDto;
  busy: boolean;
  onRecordResolution: (body: {
    resolutionTitle: string;
    minutesSummary: string;
    amendmentContext: string;
  }) => void;
};

export function TrustResolutionPanel({ detail, busy, onRecordResolution }: Props) {
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("");
  const [amendment, setAmendment] = useState("");
  const rt = detail.resolutionTracking;

  return (
    <div className="rounded-xl border border-sky-500/25 bg-sky-950/15 p-3">
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200/80">
        Resolution / minutes tracking
      </h4>
      <p className="mt-1 text-[10px] text-slate-500">
        Recorded {rt.recorded} / proposed {rt.proposed} / draft {rt.draft} — no filing or signatures.
      </p>
      {rt.openActions.length > 0 ? (
        <ul className="mt-2 list-inside list-disc text-[10px] text-slate-400">
          {rt.openActions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 space-y-2">
        <input
          className="w-full rounded border border-slate-600/50 bg-slate-950/50 px-2 py-1 text-[10px] text-slate-200"
          placeholder="Resolution title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="w-full rounded border border-slate-600/50 bg-slate-950/50 px-2 py-1 text-[10px] text-slate-200"
          placeholder="Minutes summary"
          rows={3}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
        <input
          className="w-full rounded border border-slate-600/50 bg-slate-950/50 px-2 py-1 text-[10px] text-slate-200"
          placeholder="Amendment context (optional)"
          value={amendment}
          onChange={(e) => setAmendment(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !title.trim() || !minutes.trim()}
          onClick={() =>
            onRecordResolution({
              resolutionTitle: title.trim(),
              minutesSummary: minutes.trim(),
              amendmentContext: amendment.trim(),
            })
          }
          className="rounded-lg border border-sky-500/40 bg-sky-950/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-sky-100/90 disabled:opacity-50"
        >
          Record resolution (approval queue)
        </button>
      </div>
    </div>
  );
}
