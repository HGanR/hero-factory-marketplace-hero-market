"use client";

import type { GrowthGuidance } from "@/lib/revenue-os/market-sweep-schema";

function linesFromGrowthGuidance(gg: GrowthGuidance | null | undefined): { key: string; label: string; text: string }[] {
  if (!gg) return [];
  const out: { key: string; label: string; text: string }[] = [];
  const a = gg.bentleyRolloutSummaryLine?.trim();
  if (a) out.push({ key: "sum", label: "Rollout", text: a });
  const b = gg.bentleyPilotWorkspaceRecommendationLine?.trim();
  if (b) out.push({ key: "pilot", label: "Pilots", text: b });
  const c = gg.bentleyRolloutRiskLine?.trim();
  if (c) out.push({ key: "risk", label: "Risk", text: c });
  const d = gg.bentleyRollbackTriggerLine?.trim();
  if (d) out.push({ key: "rb", label: "Rollback if", text: d });
  return out;
}

type Props = {
  growthGuidance: GrowthGuidance | null | undefined;
};

/** Renders merged rollout coaching lines from `growthGuidance` when any are present. */
export function BentleyRolloutGuidanceStrip({ growthGuidance }: Props) {
  const lines = linesFromGrowthGuidance(growthGuidance);
  if (!lines.length) return null;
  return (
    <aside
      className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3"
      aria-label="Rollout guidance"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">Rollout coaching</p>
      <ul className="mt-2 space-y-2 text-sm text-zinc-200">
        {lines.map((line) => (
          <li key={line.key} className="border-l-2 border-amber-500/40 pl-3">
            <span className="text-[11px] font-medium text-amber-100/90">{line.label}</span>
            <p className="mt-0.5 leading-snug text-zinc-300">{line.text}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
