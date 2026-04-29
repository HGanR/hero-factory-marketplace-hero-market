"use client";

export function ClientWebsitePerformancePanel({
  websiteActivity,
  activeSites,
}: {
  websiteActivity: number;
  activeSites: number;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <h2 className="text-sm font-semibold text-cyan-200/90">Website performance</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="text-xs text-slate-500">Website activity</p>
          <p className="mt-1 text-lg font-semibold text-slate-100">{websiteActivity}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="text-xs text-slate-500">Active sites</p>
          <p className="mt-1 text-lg font-semibold text-slate-100">{activeSites}</p>
        </div>
      </div>
    </section>
  );
}
