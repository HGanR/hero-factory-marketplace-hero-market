"use client";

import Link from "next/link";
import { useMemo } from "react";
import { casesHrefWithFocus, focusLabel, type CasesFocusParam } from "./casesFocus";
import { urgencyStripCounts } from "./hubMetrics";
import { useFinancialReadiness } from "./FinancialReadinessProvider";

const TILES: { key: CasesFocusParam; tone: string }[] = [
  { key: "overdue", tone: "border-red-500/30 bg-red-950/20 text-red-100/90" },
  { key: "due_this_week", tone: "border-amber-500/30 bg-amber-950/20 text-amber-100/90" },
  { key: "escalated", tone: "border-orange-500/30 bg-orange-950/20 text-orange-100/90" },
  { key: "awaiting_response", tone: "border-sky-500/30 bg-sky-950/20 text-sky-100/90" },
];

function countFor(state: ReturnType<typeof urgencyStripCounts>, key: CasesFocusParam): number {
  switch (key) {
    case "overdue":
      return state.overdueMatters;
    case "due_this_week":
      return state.dueThisWeekMatters;
    case "escalated":
      return state.escalatedMatters;
    case "awaiting_response":
      return state.awaitingResponseMatters;
    default:
      return 0;
  }
}

export function HubUrgencyStrip() {
  const { state } = useFinancialReadiness();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const counts = useMemo(() => urgencyStripCounts(state, today), [state, today]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {TILES.map(({ key, tone }) => {
        const n = countFor(counts, key);
        return (
          <Link
            key={key}
            href={casesHrefWithFocus(key)}
            className={`rounded-xl border px-4 py-3 transition-opacity ${tone} ${n === 0 ? "opacity-60" : ""}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{focusLabel(key)}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{n}</p>
            <p className="mt-1 text-xs text-slate-500">Open matters list →</p>
          </Link>
        );
      })}
    </div>
  );
}
