"use client";

import { useMemo } from "react";
import type { ActivityEntry } from "./activity";

const KIND_LABEL: Record<ActivityEntry["kind"], string> = {
  case_created: "Matter",
  document_generated: "Document",
  document_edited: "Edit",
  document_status_changed: "Doc status",
  document_followup_changed: "Doc follow-up",
  document_detached: "Detached",
  document_reassigned: "Assignment",
  case_status_changed: "Matter status",
  case_followup_changed: "Matter follow-up",
  interaction_logged: "Collector log",
  next_action_changed: "Next action",
  operational: "Action",
  bulk_vault: "Bulk (vault)",
  bulk_cases: "Bulk (matters)",
  bulk_undo: "Undo",
};

type Props = {
  caseId: string;
  activities: ActivityEntry[];
};

export function CaseTimeline({ caseId, activities }: Props) {
  const rows = useMemo(() => {
    return activities
      .filter((a) => a.caseId === caseId)
      .slice()
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [activities, caseId]);

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No activity recorded for this matter yet.</p>;
  }

  return (
    <ul className="space-y-0 border-l border-white/10 ml-1.5 pl-4">
      {rows.map((a) => (
        <li key={a.id} className="relative pb-4 last:pb-0">
          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-cyan-500/80 ring-4 ring-slate-950" />
          <p className="text-xs text-slate-500 font-mono">{new Date(a.at).toLocaleString()}</p>
          <p className="text-sm text-slate-200 mt-0.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-500 mr-2">{KIND_LABEL[a.kind]}</span>
            {a.summary}
          </p>
          {a.payload &&
            typeof a.payload === "object" &&
            "from" in a.payload &&
            "to" in a.payload &&
            a.kind !== "bulk_vault" &&
            a.kind !== "bulk_cases" &&
            a.kind !== "bulk_undo" && (
              <p className="text-xs text-slate-500 mt-1 font-mono">
                {String(JSON.stringify((a.payload as { from: unknown }).from))} →{" "}
                {String(JSON.stringify((a.payload as { to: unknown }).to))}
              </p>
            )}
          {(a.kind === "bulk_vault" || a.kind === "bulk_cases" || a.kind === "bulk_undo") && a.payload && (
            <pre className="text-[10px] text-slate-500 mt-1 whitespace-pre-wrap break-all max-h-36 overflow-auto">
              {JSON.stringify(a.payload, null, 2)}
            </pre>
          )}
        </li>
      ))}
    </ul>
  );
}
