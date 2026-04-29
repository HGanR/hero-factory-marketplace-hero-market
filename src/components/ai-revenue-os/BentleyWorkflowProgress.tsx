"use client";

import {
  checklistMilestoneLabel,
  getChecklistStatus,
  getWorkflowPhase,
  phaseLabel,
} from "@/lib/revenue-os/bentley-orchestrator";
import type { BentleyChecklistId } from "@/lib/revenue-os/bentley-flow-types";
import { useAiRevenueOsBentleyActions, useAiRevenueOsSnapshotSignature } from "./AiRevenueOsSharedState";

const CHECKLIST_ORDER: BentleyChecklistId[] = [
  "intake",
  "revenue_inputs",
  "content_profile",
  "campaign_notes",
  "ready_to_run",
];

export function BentleyWorkflowProgress() {
  useAiRevenueOsSnapshotSignature();
  const { getBentleySnapshot, isProviderActive } = useAiRevenueOsBentleyActions();

  if (!isProviderActive) return null;

  const snap = getBentleySnapshot();
  const checklist = getChecklistStatus(snap);
  const phase = getWorkflowPhase(snap);

  return (
    <div
      className="rounded-2xl border border-cyan-500/40 bg-slate-900/70 px-4 py-4 md:px-6 md:py-5 shadow-lg shadow-cyan-500/5"
      aria-label="Bentley workflow progress"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400/90">Bentley workflow</p>
          <p className="text-sm text-slate-300 mt-1">
            Current phase: <span className="text-white font-medium">{phaseLabel(phase)}</span>
          </p>
        </div>
        <ol className="flex flex-wrap gap-2 md:justify-end">
          {CHECKLIST_ORDER.map((id) => {
            const done = checklist[id] === "complete";
            return (
              <li
                key={id}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  done
                    ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-200"
                    : "border-slate-600/80 bg-slate-950/50 text-slate-400"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${done ? "bg-emerald-400" : "bg-slate-500"}`}
                  aria-hidden
                />
                {checklistMilestoneLabel(id)}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
