"use client";

type Point = { label: string; value: number };

export function ClientMetricTrendCard({
  title,
  points,
  emptyLabel,
}: {
  title: string;
  points: Point[];
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const hasData = points.some((p) => p.value > 0);
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">{title}</h3>
      {!hasData ? (
        <p className="mt-3 text-xs text-slate-500">{emptyLabel ?? "No historical data yet."}</p>
      ) : (
        <div className="mt-3 flex items-end gap-1">
          {points.map((p) => (
            <div key={p.label} className="flex-1">
              <div className="rounded-t bg-cyan-500/70" style={{ height: `${Math.max(6, Math.round((p.value / max) * 72))}px` }} />
              <div className="mt-1 text-center text-[10px] text-slate-500">{p.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
