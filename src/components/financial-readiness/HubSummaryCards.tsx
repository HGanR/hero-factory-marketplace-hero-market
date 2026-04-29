"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FileText, Gauge, ListTodo, ShieldAlert } from "lucide-react";
import { useFinancialReadiness } from "./FinancialReadinessProvider";
import { activeCaseCount, moduleProgressPct, recommendedNextAction, upcomingDueItems } from "./hubMetrics";
import { DocumentBadgesRow, MatterBadgesRow } from "./vaultBadges";

function Card({
  title,
  value,
  sub,
  icon,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 flex gap-3">
      <div className="text-cyan-400/90 mt-0.5">{icon}</div>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
        <p className="text-lg font-semibold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{sub}</p>}
      </div>
    </div>
  );
}

export function HubSummaryCards() {
  const { state } = useFinancialReadiness();
  const pct = moduleProgressPct(state);
  const letters = state.documents.length;
  const cases = activeCaseCount(state);
  const next = recommendedNextAction(state);
  const dues = upcomingDueItems(state, 3);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-white">Workspace snapshot</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <Card
          title="Progress by module"
          value={`${pct.foundation}% · ${pct.optimization}% · ${pct.resolution}%`}
          sub="Foundation · Optimization · Resolution (step checkpoints)"
          icon={<Gauge className="h-5 w-5" />}
        />
        <Card
          title="Active matters"
          value={cases}
          sub={cases ? "Open operational cases (not completed / escalated)" : "No active matters"}
          icon={<ShieldAlert className="h-5 w-5" />}
        />
        <Card
          title="Vault documents"
          value={letters}
          sub={letters ? "Normalized with status + due dates" : "Draft from Optimization or Resolution"}
          icon={<FileText className="h-5 w-5" />}
        />
        <Card title="Recommended next" value="Guidance" sub={next} icon={<ListTodo className="h-5 w-5" />} />
      </div>
      {dues.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-200/90 mb-2">Upcoming follow-ups</p>
          <ul className="space-y-1.5 text-sm">
            {dues.map((d) => {
              const matter = d.kind === "matter" ? state.cases.find((c) => c.id === d.id) : null;
              const letter = d.kind === "document" ? state.documents.find((x) => x.id === d.id) : null;
              return (
                <li key={`${d.kind}-${d.id}`} className="flex flex-wrap justify-between gap-2 text-slate-300">
                  <div className="min-w-0 flex-1">
                    <Link href={d.href} className="text-cyan-300 hover:underline block truncate">
                      {d.label}
                    </Link>
                    {letter && (
                      <div className="mt-1">
                        <DocumentBadgesRow status={letter.status} tags={letter.tags} />
                      </div>
                    )}
                    {matter && (
                      <div className="mt-1">
                        <MatterBadgesRow status={matter.status} tags={matter.tags} />
                      </div>
                    )}
                  </div>
                  <span className="text-white font-mono text-xs shrink-0">{d.due}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {letters > 0 && (
        <p className="text-xs text-slate-500">
          <Link href="/financial-readiness#documents" className="text-cyan-400 hover:underline">
            Jump to document vault
          </Link>
        </p>
      )}
    </div>
  );
}
