"use client";

import type { BentleySocialCommandCenterPayload } from "@/lib/revenue-os/social-command-center";

type Props = {
  reports: BentleySocialCommandCenterPayload["reports"];
};

export function BentleyReportsPanel({ reports }: Props) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-zinc-950/50 p-4">
        <h3 className="text-sm font-semibold text-zinc-100">Daily operator report</h3>
        {reports.dailyOperator ? (
          <div className="mt-3 space-y-2 text-sm text-zinc-300">
            <p className="font-medium text-zinc-100">{reports.dailyOperator.headline}</p>
            <p>{reports.dailyOperator.executiveSummary}</p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-zinc-400">
              {reports.dailyOperator.recommendedActions.slice(0, 8).map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">Enable includeHeavyReports or sign in to load executive narratives.</p>
        )}
      </section>
      <section className="rounded-xl border border-white/10 bg-zinc-950/50 p-4">
        <h3 className="text-sm font-semibold text-zinc-100">Weekly executive report</h3>
        {reports.weeklyExecutive ? (
          <div className="mt-3 space-y-2 text-sm text-zinc-300">
            <p className="font-medium text-zinc-100">{reports.weeklyExecutive.headline}</p>
            <p>{reports.weeklyExecutive.executiveSummary}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">Heavy reports skipped for this request.</p>
        )}
      </section>
      <section className="rounded-xl border border-cyan-500/15 bg-cyan-950/10 p-4">
        <h3 className="text-sm font-semibold text-cyan-100/90">Operator digest</h3>
        <p className="mt-2 text-sm text-zinc-300">{reports.digest.headline}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3 text-xs">
          <div>
            <div className="text-zinc-500">Key wins</div>
            <ul className="mt-1 list-disc pl-4 text-zinc-400">
              {reports.digest.keyWins.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {!reports.digest.keyWins.length ? <li>—</li> : null}
            </ul>
          </div>
          <div>
            <div className="text-zinc-500">Key risks</div>
            <ul className="mt-1 list-disc pl-4 text-zinc-400">
              {reports.digest.keyRisks.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {!reports.digest.keyRisks.length ? <li>—</li> : null}
            </ul>
          </div>
          <div>
            <div className="text-zinc-500">Next actions</div>
            <ul className="mt-1 list-disc pl-4 text-zinc-400">
              {reports.digest.nextBestActions.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {!reports.digest.nextBestActions.length ? <li>—</li> : null}
            </ul>
          </div>
        </div>
      </section>
      <section className="rounded-xl border border-white/10 p-4">
        <h3 className="text-sm font-semibold text-zinc-100">Exceptions & automation</h3>
        <p className="mt-2 text-xs text-zinc-400">{reports.exceptions.exceptionSummary}</p>
        {reports.proactiveLine ? <p className="mt-2 text-xs text-zinc-400">{reports.proactiveLine}</p> : null}
      </section>
    </div>
  );
}
