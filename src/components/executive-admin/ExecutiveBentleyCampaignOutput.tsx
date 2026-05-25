"use client";

import type { ExecutiveBentleyHudCampaignOutputs } from "@/lib/revenue-os/executive-bentley-hud";

type Props = {
  outputs: ExecutiveBentleyHudCampaignOutputs;
  launchGated: boolean;
  governanceLine?: string;
};

function OutputList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-wide text-[#00b7ff]/60">{title}</div>
      <ul className="mt-1 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-[10px] leading-snug text-slate-300 line-clamp-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ExecutiveBentleyCampaignOutput({ outputs, launchGated, governanceLine }: Props) {
  const hasAny =
    outputs.hooks.length ||
    outputs.captions.length ||
    outputs.imagePrompts.length ||
    outputs.videoPrompts.length ||
    outputs.postingRecommendations.length ||
    outputs.kpiExpectations.length;

  if (!hasAny) {
    return (
      <p className="text-[10px] text-slate-500">
        Campaign outputs will appear here as Bentley completes generation stages.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#00A3FF]/15 bg-[#00050A]/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#00b7ff]/70">
          Campaign outputs
        </span>
        {launchGated ? (
          <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[8px] uppercase text-amber-200/90">
            Approval gated
          </span>
        ) : null}
      </div>
      <OutputList title="Hooks" items={outputs.hooks} />
      <OutputList title="Captions" items={outputs.captions} />
      <OutputList title="Image prompts" items={outputs.imagePrompts} />
      <OutputList title="Video prompts" items={outputs.videoPrompts} />
      <OutputList title="Posting" items={outputs.postingRecommendations} />
      <OutputList title="KPI expectations" items={outputs.kpiExpectations} />
      {governanceLine ? (
        <p className="text-[9px] text-amber-200/80 border-t border-amber-500/20 pt-2">{governanceLine}</p>
      ) : null}
    </div>
  );
}
