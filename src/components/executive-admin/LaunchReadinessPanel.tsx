"use client";

import { useState } from "react";
import type { RevenueOsFulfillmentOrderDetailResultDto } from "@/lib/fulfillment/revenue-os-fulfillment-dtos";

type Props = {
  detail: RevenueOsFulfillmentOrderDetailResultDto;
  busy: boolean;
  onProposeLaunchReadiness: (body: {
    readinessSummary: string;
    ownerAttestation: string;
    blockersResolved: string[];
  }) => void;
  onOpenApproval?: (approvalId: string) => void;
};

export function LaunchReadinessPanel({
  detail,
  busy,
  onProposeLaunchReadiness,
  onOpenApproval,
}: Props) {
  const lr = detail.launchReadiness;
  const kpi = detail.kpiSnapshot;
  const [summary, setSummary] = useState(
    `Launch readiness score ${lr.score}. KPI health: ${kpi.kpiHealth}. Checkpoint only — no sync-launch.`
  );
  const [attestation, setAttestation] = useState(
    "I confirm launch blockers are understood and launch execution remains owner-approved via Bentley approvals."
  );

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/10 p-3">
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200/80">
        Launch readiness tracking
      </h4>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
        <span className="rounded border border-slate-600/50 px-2 py-0.5 text-slate-300">Score: {lr.score}</span>
        <span
          className={`rounded border px-2 py-0.5 ${lr.ready ? "border-emerald-500/40 text-emerald-100/90" : "border-amber-500/40 text-amber-100/90"}`}
        >
          {lr.ready ? "Ready (checkpoint)" : "Not ready"}
        </span>
        <span className="rounded border border-slate-600/50 px-2 py-0.5 text-slate-400">
          KPI: {kpi.kpiHealth}
        </span>
      </div>
      {lr.blockers.length > 0 ? (
        <ul className="mt-2 list-inside list-disc text-[10px] text-amber-200/80">
          {lr.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[10px] text-slate-500">No launch blockers detected.</p>
      )}
      {lr.dependencies.length > 0 ? (
        <ul className="mt-2 list-inside list-disc text-[10px] text-slate-500">
          {lr.dependencies.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : null}
      {lr.approvalId ? (
        <button
          type="button"
          className="mt-2 text-[10px] text-amber-200/90 underline"
          onClick={() => onOpenApproval?.(lr.approvalId!)}
        >
          Launch checkpoint approval pending
        </button>
      ) : null}
      <label className="mt-3 block text-[10px] text-slate-400">
        Readiness summary
        <textarea
          className="mt-1 w-full rounded border border-slate-700/60 bg-slate-950/60 p-2 text-[11px] text-slate-200"
          rows={3}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </label>
      <label className="mt-2 block text-[10px] text-slate-400">
        Owner attestation
        <textarea
          className="mt-1 w-full rounded border border-slate-700/60 bg-slate-950/60 p-2 text-[11px] text-slate-200"
          rows={2}
          value={attestation}
          onChange={(e) => setAttestation(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy || lr.approvalCheckpointStatus === "pending"}
        onClick={() =>
          onProposeLaunchReadiness({
            readinessSummary: summary,
            ownerAttestation: attestation,
            blockersResolved: lr.blockers,
          })
        }
        className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100/90 disabled:opacity-50"
      >
        Propose launch readiness checkpoint
      </button>
    </div>
  );
}
