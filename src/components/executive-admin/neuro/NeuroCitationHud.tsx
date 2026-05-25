"use client";

import type { NeuroPassageCitationDto } from "@/lib/executive-agent/neuro/neuro-types";

type Props = {
  hits: NeuroPassageCitationDto[];
  disclaimer?: string | null;
  onSelect: (hit: NeuroPassageCitationDto) => void;
};

export function NeuroCitationHud({ hits, disclaimer, onSelect }: Props) {
  if (!hits.length) {
    return (
      <p className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-2 text-[10px] text-slate-500">
        No NEURO citations yet — search indexed sources above.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {disclaimer ? (
        <p className="rounded-lg border border-amber-500/25 bg-amber-950/15 px-2 py-1.5 text-[9px] text-amber-100/85">
          {disclaimer}
        </p>
      ) : null}
      {hits.map((hit) => (
        <button
          key={hit.chunkId}
          type="button"
          onClick={() => onSelect(hit)}
          className="w-full rounded-lg border border-cyan-500/25 bg-cyan-950/10 px-3 py-2 text-left transition hover:border-cyan-400/45 hover:bg-cyan-950/25"
        >
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-[10px] font-semibold text-cyan-100">{hit.fileName}</span>
            <span className="text-[9px] text-violet-300">
              {(hit.confidence * 100).toFixed(0)}% · {hit.citationLabel}
            </span>
          </div>
          <p className="mt-1 line-clamp-3 text-[10px] leading-snug text-slate-300">{hit.snippet}</p>
        </button>
      ))}
    </div>
  );
}
