"use client";

import type { FC } from "react";

/**
 * Curated static mini-frames that mirror real preview block patterns (hero, stat band, rhythm)
 * — lightweight DOM only, no API or motion. Click still maps to inspiration examples (parent).
 */

export type OutputProofFeelId = "web3" | "corporate" | "minimal";

type Props = {
  disabled?: boolean;
  onPickFeel?: (id: OutputProofFeelId) => void;
};

/** Web3: Signature-style hero (gradient, grid hint, cyan pills) + compact stat strip — like generated web3_product. */
function SnapshotWeb3() {
  return (
    <div className="relative h-[88px] w-full overflow-hidden rounded-md border border-white/[0.09] bg-gradient-to-b from-slate-950 via-indigo-950/40 to-slate-950 p-1">
      <div className="relative overflow-hidden rounded-lg border border-cyan-500/20 bg-gradient-to-br from-indigo-900/85 via-slate-900/95 to-violet-950/90 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_20px_-6px_rgba(34,211,238,0.2)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)`,
            backgroundSize: "7px 7px",
          }}
        />
        <svg className="pointer-events-none absolute bottom-1 left-1 right-1 h-3 w-[calc(100%-8px)] text-cyan-400/35" viewBox="0 0 120 12" preserveAspectRatio="none">
          <path d="M4,8 C28,4 44,10 60,6 S92,4 116,7" fill="none" stroke="currentColor" strokeWidth="0.8" />
        </svg>
        <div className="relative space-y-0.5">
          <div className="h-1.5 w-[78%] rounded-sm bg-white/30" />
          <div className="h-0.5 w-full max-w-[95%] rounded-full bg-white/12" />
          <div className="flex gap-0.5 pt-0.5">
            <span className="h-1.5 min-w-[18px] rounded-full border border-cyan-400/40 bg-cyan-500/20" />
            <span className="h-1.5 min-w-[14px] rounded-full border border-white/15 bg-white/[0.07]" />
          </div>
        </div>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-0.5 rounded-md border border-white/[0.06] bg-slate-950/70 px-1 py-0.5">
        {["24ms", "Live", "∞"].map((t) => (
          <div key={t} className="flex flex-1 flex-col items-center gap-px">
            <span className="text-[6px] font-semibold tabular-nums text-cyan-200/90">{t}</span>
            <span className="h-px w-3 rounded-full bg-slate-600/60" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Corporate: operator hero + sky accent — like saas / trust_operator preview. */
function SnapshotCorporate() {
  return (
    <div className="relative h-[88px] w-full overflow-hidden rounded-md border border-white/[0.08] bg-gradient-to-b from-slate-950 to-slate-900 p-1">
      <div className="relative overflow-hidden rounded-lg border border-sky-500/15 bg-gradient-to-r from-slate-800/95 via-slate-800/85 to-slate-800/95 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="absolute right-1 top-1 h-2 w-2 rounded-full bg-sky-400/35 shadow-[0_0_8px_rgba(56,189,248,0.35)]" />
        <div className="space-y-0.5 pr-3">
          <div className="h-1.5 w-[70%] rounded-sm bg-slate-200/90" />
          <div className="h-0.5 w-full rounded-full bg-slate-400/22" />
          <div className="h-0.5 w-[55%] rounded-full bg-slate-500/25" />
        </div>
        <div className="mt-1 flex gap-0.5">
          <span className="h-1.5 flex-1 rounded border border-sky-500/30 bg-sky-500/15" />
          <span className="h-1.5 w-4 rounded border border-white/10 bg-white/[0.05]" />
        </div>
      </div>
      <div className="mt-0.5 grid grid-cols-3 gap-0.5 rounded-md border border-white/[0.05] bg-slate-950/50 p-0.5">
        {["Uptime", "Teams", "SLA"].map((l) => (
          <div key={l} className="rounded bg-slate-900/80 py-0.5 text-center">
            <div className="text-[6px] font-semibold text-slate-100">99.9</div>
            <div className="text-[5px] uppercase tracking-wide text-slate-500">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Minimal / editorial: airy hero, restrained chrome — like portfolio + minimal direction. */
function SnapshotMinimal() {
  return (
    <div className="relative h-[88px] w-full overflow-hidden rounded-md border border-stone-700/30 bg-gradient-to-b from-stone-950 to-neutral-950 p-1">
      <div className="mx-0.5 mt-1 space-y-1 rounded-lg border border-stone-600/20 bg-stone-900/40 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="h-px w-4 bg-stone-500/35" />
        <div className="h-1 w-[62%] rounded-sm bg-stone-300/35" />
        <div className="space-y-0.5 pt-0.5">
          <div className="h-0.5 w-full rounded-full bg-stone-500/18" />
          <div className="h-0.5 w-[88%] rounded-full bg-stone-500/14" />
          <div className="h-0.5 w-[40%] rounded-full bg-stone-500/12" />
        </div>
        <div className="pt-1">
          <span className="inline-block border-b border-stone-400/30 pb-px text-[6px] font-medium tracking-wide text-stone-400/90">Read</span>
        </div>
      </div>
    </div>
  );
}

const SNAPSHOT: Record<OutputProofFeelId, FC> = {
  web3: SnapshotWeb3,
  corporate: SnapshotCorporate,
  minimal: SnapshotMinimal,
};

const FEEL_META: ReadonlyArray<{ id: OutputProofFeelId; label: string; fitCue: string }> = [
  { id: "web3", label: "Web3-forward", fitCue: "Launches, drops, reveals" },
  { id: "corporate", label: "Calm / credible", fitCue: "Services, operator trust" },
  { id: "minimal", label: "Editorial / spare", fitCue: "Stories, editorial clarity" },
];

export function DescribeOutputProofStrip({ disabled, onPickFeel }: Props) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
      {FEEL_META.map((f) => {
        const interactive = Boolean(onPickFeel) && !disabled;
        const Snapshot = SNAPSHOT[f.id];
        const body = (
          <>
            <Snapshot />
            <p className="mt-1.5 text-center text-[10px] font-medium leading-tight text-slate-400">{f.label}</p>
            <p className="mt-0.5 text-center text-[9px] font-normal leading-snug text-slate-600">{f.fitCue}</p>
          </>
        );
        if (interactive) {
          return (
            <button
              key={f.id}
              type="button"
              disabled={disabled}
              onClick={() => onPickFeel?.(f.id)}
              className="group min-w-0 rounded-md text-left transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400/35 disabled:pointer-events-none disabled:opacity-40"
              aria-label={`Apply ${f.label} example. ${f.fitCue}`}
            >
              {body}
            </button>
          );
        }
        return (
          <div key={f.id} className="min-w-0">
            {body}
          </div>
        );
      })}
    </div>
  );
}
