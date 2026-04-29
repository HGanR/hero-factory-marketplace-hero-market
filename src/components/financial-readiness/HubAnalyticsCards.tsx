"use client";

import { useMemo } from "react";
import { CalendarPlus, FileText, CheckCircle, AlertTriangle, ShieldAlert } from "lucide-react";
import { useFinancialReadiness } from "./FinancialReadinessProvider";
import { hubAnalyticsSnapshot } from "./hubMetrics";

export function HubAnalyticsCards() {
  const { state } = useFinancialReadiness();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const a = useMemo(() => hubAnalyticsSnapshot(state, today), [state, today]);

  const items = [
    {
      label: "Matters created (week)",
      value: a.mattersCreatedThisWeek,
      icon: <CalendarPlus className="h-4 w-4 text-cyan-400/90" />,
    },
    {
      label: "Letters generated (week)",
      value: a.lettersGeneratedThisWeek,
      icon: <FileText className="h-4 w-4 text-violet-400/90" />,
    },
    {
      label: "Overdue matters",
      value: a.overdueMatters,
      icon: <AlertTriangle className="h-4 w-4 text-rose-400/90" />,
    },
    {
      label: "Resolved (week)",
      value: a.resolvedMattersThisWeek,
      icon: <CheckCircle className="h-4 w-4 text-emerald-400/90" />,
    },
    {
      label: "Escalated (open)",
      value: a.escalatedMattersTotal,
      icon: <ShieldAlert className="h-4 w-4 text-amber-400/90" />,
    },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 mb-3">This week & queue</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {items.map((it) => (
          <div
            key={it.label}
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 flex gap-2.5 items-start"
          >
            <span className="mt-0.5">{it.icon}</span>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500 leading-tight">{it.label}</p>
              <p className="text-xl font-semibold text-white tabular-nums mt-0.5">{it.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
