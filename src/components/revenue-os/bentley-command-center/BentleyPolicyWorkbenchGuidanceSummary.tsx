"use client";

import type { GrowthGuidance } from "@/lib/revenue-os/market-sweep-schema";
import {
  hasWorkbenchScenarioGuidanceSummaryLines,
  workbenchScenarioGuidanceLinesForUi,
} from "@/lib/revenue-os/policy-workbench-guidance-ui";

type Props = {
  growthGuidance: GrowthGuidance | null | undefined;
};

/**
 * Compact scenario-compare / preset / apply-review lines merged into `growthGuidance`.
 * Renders nothing when none of those three optional lines are present.
 */
export function BentleyPolicyWorkbenchGuidanceSummary({ growthGuidance }: Props) {
  if (!hasWorkbenchScenarioGuidanceSummaryLines(growthGuidance)) return null;
  const lines = workbenchScenarioGuidanceLinesForUi(growthGuidance);
  return (
    <aside
      className="rounded-xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/[0.07] to-transparent px-4 py-3 shadow-[inset_0_1px_0_0_rgba(34,211,238,0.12)]"
      aria-label="Policy workbench guidance"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400/95">Policy workbench</p>
      <ul className="mt-2.5 space-y-2">
        {lines.map((line) => (
          <li key={line.key} className="border-l-2 border-cyan-500/45 pl-3">
            <span className="text-[11px] font-medium text-cyan-200/90">{line.label}</span>
            <p className="mt-0.5 text-sm leading-snug text-zinc-200/95">{line.text}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
