"use client";

import { useAiRevenueOsSystemSignals } from "@/components/ai-revenue-os/AiRevenueOsSharedState";

const ACCENT = "#00D1FF";

type RowKey =
  | "opportunityScore"
  | "offerStrengthScore"
  | "trafficReadinessScore"
  | "executionGapScore"
  | "capitalReadinessScore";

const ROWS: { key: RowKey; label: string }[] = [
  { key: "opportunityScore", label: "Opportunity Engine" },
  { key: "offerStrengthScore", label: "Offer Engine" },
  { key: "trafficReadinessScore", label: "Traffic Engine" },
  { key: "executionGapScore", label: "Execution Engine" },
  { key: "capitalReadinessScore", label: "Capital Engine" },
];

function messageFor(row: RowKey, value: number | undefined): string {
  if (value === undefined) {
    if (row === "executionGapScore") return "Complete steps to assess execution gap";
    if (row === "capitalReadinessScore") return "Capital layer not configured";
    return "Awaiting signal from your inputs";
  }
  switch (row) {
    case "opportunityScore":
      if (value >= 70) return "Opportunity validated";
      if (value >= 40) return "Emerging demand signal";
      return "Strengthen research & trends";
    case "offerStrengthScore":
      if (value >= 70) return "Offer structure solid";
      if (value >= 40) return "Offer needs clarity";
      return "Define offer & transformation";
    case "trafficReadinessScore":
      if (value >= 60) return "Traffic system ready";
      if (value >= 35) return "Add platforms & content";
      return "Generate content & pick channels";
    case "executionGapScore":
      if (value >= 70) return "Execution gap detected";
      if (value >= 45) return "Some pipeline steps pending";
      return "Execution on track";
    case "capitalReadinessScore":
      if (value >= 55) return "Scalable / leverage signals";
      if (value >= 30) return "Capital hints present";
      return "Capital layer not configured";
    default:
      return "";
  }
}

export function SystemInsightPanel() {
  const { isProviderActive, systemSignals } = useAiRevenueOsSystemSignals();

  if (!isProviderActive) return null;

  return (
    <section
      className="rounded-2xl border border-cyan-500/35 bg-slate-900/70 p-4 shadow-[0_4px_24px_rgba(0,209,255,0.08)]"
      aria-label="Five-system diagnostic scores"
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">System diagnostics</div>
      <p className="mt-1 text-[11px] text-slate-500 leading-snug">
        Heuristic scores from your intake, pipeline, and workflow — updated when you run steps or the automated pipeline.
      </p>
      <ul className="mt-4 space-y-3">
        {ROWS.map(({ key, label }) => {
          const v = systemSignals[key];
          const pct = v ?? 0;
          const displayPct = v === undefined ? 0 : pct;
          return (
            <li key={key}>
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-xs font-medium text-slate-200">{label}</span>
                <span className="text-[10px] text-slate-500 tabular-nums">{v === undefined ? "—" : `${v}%`}</span>
              </div>
              <div
                className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden"
                role="progressbar"
                aria-valuenow={v === undefined ? undefined : displayPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={label}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${displayPct}%`,
                    background:
                      key === "executionGapScore"
                        ? "linear-gradient(90deg, #f59e0b, #ea580c)"
                        : `linear-gradient(90deg, ${ACCENT}, #06b6d4)`,
                    opacity: v === undefined ? 0.25 : 1,
                  }}
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-400 leading-snug">{messageFor(key, v)}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
