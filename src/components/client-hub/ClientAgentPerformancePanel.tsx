"use client";

export function ClientAgentPerformancePanel({
  responseVolume,
  campaignActivity,
}: {
  responseVolume: number;
  campaignActivity: number;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <h2 className="text-sm font-semibold text-cyan-200/90">Agent performance</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Metric label="Agent response volume" value={responseVolume} />
        <Metric label="Campaign activity" value={campaignActivity} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-100">{value}</p>
    </div>
  );
}
