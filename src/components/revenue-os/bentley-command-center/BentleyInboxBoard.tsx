"use client";

import type { BentleySocialCommandCenterPayload } from "@/lib/revenue-os/social-command-center";

const LANE_LABEL: Record<string, string> = {
  high_intent: "Lead intent",
  objections: "Objections",
  trust_seeking: "Trust-seeking",
  handoff_ready: "Handoff ready",
  reviewed_routed: "Reviewed / routed",
  engagement: "Engagement",
};

type Props = {
  inbox: BentleySocialCommandCenterPayload["inbox"];
};

export function BentleyInboxBoard({ inbox }: Props) {
  return (
    <div className="space-y-4">
      {inbox.leadSummaryLine ? (
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-100/90">
          {inbox.leadSummaryLine}
        </p>
      ) : (
        <p className="text-sm text-zinc-500">No lead signals in this workspace window — capture intent from connected social surfaces.</p>
      )}
      {inbox.handoffSummary ? (
        <p className="text-xs text-zinc-500">
          Handoff pipeline · open: {inbox.handoffSummary.totalOpen}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(inbox.lanes).map(([lane, rows]) => (
          <div key={lane} className="rounded-xl border border-white/10 bg-zinc-950/40 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {LANE_LABEL[lane] ?? lane} ({rows.length})
            </div>
            <div className="mt-2 space-y-2">
              {rows.slice(0, 20).map((r) => (
                <div key={r.id} className="rounded-lg border border-white/5 bg-black/30 p-2 text-xs text-zinc-300">
                  <div className="flex flex-wrap gap-1">
                    <span className="rounded bg-white/5 px-1 text-[10px] uppercase text-zinc-400">{r.sourcePlatform}</span>
                    <span className="text-[10px] text-zinc-500">{r.signalClass ?? "signal"}</span>
                    <span className="text-[10px] text-zinc-500">intent {(r.commercialIntentScore * 100).toFixed(0)}%</span>
                    {r.handoffStatus ? (
                      <span className="rounded bg-violet-500/10 px-1 text-[10px] text-violet-200">
                        handoff {r.handoffStatus}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-3 text-zinc-200">{r.extractedText}</p>
                  {r.recommendedFollowup ? (
                    <p className="mt-1 text-[11px] text-cyan-200/80">Autonomous actions · follow-up: {r.recommendedFollowup}</p>
                  ) : null}
                </div>
              ))}
              {!rows.length ? <p className="text-zinc-600">—</p> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
