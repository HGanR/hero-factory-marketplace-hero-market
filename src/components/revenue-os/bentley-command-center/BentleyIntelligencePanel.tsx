"use client";

import type { BentleySocialCommandCenterPayload } from "@/lib/revenue-os/social-command-center";
import { BentleyPolicyWorkbenchGuidanceSummary } from "@/components/revenue-os/bentley-command-center/BentleyPolicyWorkbenchGuidanceSummary";
import { BentleyRolloutGuidanceStrip } from "@/components/revenue-os/bentley-command-center/BentleyRolloutGuidanceStrip";

type Props = {
  intelligence: BentleySocialCommandCenterPayload["intelligence"];
};

export function BentleyIntelligencePanel({ intelligence }: Props) {
  const blocks = [
    intelligence.marketIntelligence,
    intelligence.contentPatterns,
    intelligence.gapsOpportunities,
    intelligence.bentleyRecommendation,
  ];
  return (
    <div className="space-y-4">
      <BentleyPolicyWorkbenchGuidanceSummary growthGuidance={intelligence.growthGuidance} />
      <BentleyRolloutGuidanceStrip growthGuidance={intelligence.growthGuidance} />
      <div className="grid gap-4 md:grid-cols-2">
      {blocks.map((b) => (
        <section
          key={b.title}
          className="rounded-xl border border-white/10 bg-zinc-950/50 p-4"
        >
          <h3 className="text-sm font-semibold text-zinc-100">{b.title}</h3>
          {intelligence.sweepGeneratedAt ? (
            <p className="mt-1 text-[10px] text-zinc-500">Market sweep · {intelligence.sweepGeneratedAt.slice(0, 16)} UTC</p>
          ) : (
            <p className="mt-1 text-[10px] text-zinc-500">Run a market sweep to populate this workspace.</p>
          )}
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            {b.lines.length ? (
              b.lines.slice(0, 12).map((line, i) => (
                <li key={i} className="line-clamp-4 border-l-2 border-cyan-500/30 pl-3">
                  {line}
                </li>
              ))
            ) : (
              <li className="text-zinc-500">No intelligence rows for this scope yet.</li>
            )}
          </ul>
        </section>
      ))}
      </div>
    </div>
  );
}
