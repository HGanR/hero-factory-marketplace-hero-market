"use client";

import type { RichScenarioCompareRow } from "@/lib/revenue-os/scenario-compare";
import { highlightClassForCell } from "@/lib/revenue-os/scenario-compare-ui";

export type RichMatrixUiPayload = {
  headline: string;
  columns: Array<{ id: string; label: string; hint?: string }>;
  rows: RichScenarioCompareRow[];
  badges: {
    safest: { label: string; scenarioId: string | null };
    highestUpside: { label: string; scenarioId: string | null };
    balanced: { title: string; body: string };
  };
  meta: { pairedScenarioMode: boolean; recommendationPreset: string | null };
};

type Props = {
  payload: RichMatrixUiPayload | null;
};

const METRIC_IDS = [
  "addedAutoActions",
  "removedAutoActions",
  "addedApprovals",
  "removedApprovals",
  "changedNotifications",
  "changedQueueStates",
  "handoffVolumeDelta",
] as const;

function cell(
  row: RichScenarioCompareRow,
  col: (typeof METRIC_IDS)[number] | "recommendationNote"
): string | number | null {
  if (col === "recommendationNote") return row.recommendationNote;
  const v = row[col];
  return v === undefined ? null : v;
}

export function BentleyScenarioCompareMatrix({ payload }: Props) {
  if (!payload?.rows?.length) {
    return (
      <p className="text-sm text-zinc-500">
        No scenarios to display — save scenarios or compare with ad hoc payloads.
      </p>
    );
  }

  return (
    <div className="space-y-4 overflow-x-auto">
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2 py-1 text-emerald-200">
          {payload.badges.safest.label}
        </span>
        <span className="rounded-full border border-amber-500/30 bg-amber-950/40 px-2 py-1 text-amber-100">
          {payload.badges.highestUpside.label}
        </span>
        <span className="rounded-full border border-cyan-500/30 bg-cyan-950/40 px-2 py-1 text-cyan-100">
          {payload.badges.balanced.title}: {payload.badges.balanced.body.slice(0, 120)}
          {payload.badges.balanced.body.length > 120 ? "…" : ""}
        </span>
        {payload.meta.pairedScenarioMode ? (
          <span className="text-zinc-500">Paired mode</span>
        ) : null}
        {payload.meta.recommendationPreset ? (
          <span className="text-zinc-500">Preset: {payload.meta.recommendationPreset}</span>
        ) : null}
      </div>

      <table className="w-full min-w-[720px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-white/10 text-zinc-500">
            <th className="py-2 pr-2 font-medium">Scenario</th>
            <th className="py-2 pr-2 font-medium">Type</th>
            <th className="py-2 pr-2 font-medium">Risk</th>
            {METRIC_IDS.map((id) => (
              <th key={id} className="py-2 pr-2 font-medium">
                {id.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
              </th>
            ))}
            <th className="py-2 font-medium">Note</th>
          </tr>
        </thead>
        <tbody>
          {payload.rows.map((row) => (
            <tr key={row.id} className="border-b border-white/5">
              <td className="py-2 pr-2 font-medium text-zinc-200">{row.name}</td>
              <td className="py-2 pr-2 text-zinc-400">{row.scenarioType}</td>
              <td className="py-2 pr-2 capitalize text-zinc-400">{row.riskLevel}</td>
              {METRIC_IDS.map((mid) => {
                const h = row.highlights[mid] ?? "neutral";
                const val = cell(row, mid);
                const display = val === null || val === undefined ? "—" : String(val);
                return (
                  <td key={mid} className={`py-2 pr-2 ${highlightClassForCell(h)}`}>
                    {display}
                  </td>
                );
              })}
              <td className="py-2 text-zinc-500">{row.recommendationNote}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
