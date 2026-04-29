"use client";

import type { BentleyKpiCard, CommandCenterSection } from "@/lib/revenue-os/social-command-center";

type Props = {
  kpis: BentleyKpiCard[];
  active: CommandCenterSection;
  onFocus: (section: CommandCenterSection) => void;
};

export function BentleyCommandCenterKpis({ kpis, active, onFocus }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
      {kpis.map((k) => {
        const isActive = active === "all" || active === k.focusSection;
        return (
          <button
            key={k.id}
            type="button"
            onClick={() => onFocus(k.focusSection)}
            className={`rounded-xl border px-3 py-2 text-left transition hover:border-cyan-500/40 ${
              isActive ? "border-cyan-500/50 bg-cyan-950/20" : "border-white/10 bg-zinc-950/40"
            }`}
          >
            <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{k.label}</div>
            <div className="mt-1 font-mono text-xl text-zinc-100">{k.value}</div>
            <div className="mt-1 line-clamp-2 text-[11px] text-zinc-500">{k.hint}</div>
          </button>
        );
      })}
    </div>
  );
}
