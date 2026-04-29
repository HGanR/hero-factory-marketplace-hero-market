type Point = { label: string; value: number };

export function PortalTrendChart({ title, points }: { title: string; points: Point[] }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-2 flex items-end gap-1">
        {points.map((p) => (
          <div key={p.label} className="flex-1">
            <div className="rounded-t bg-cyan-600/80" style={{ height: `${Math.max(4, Math.round((p.value / max) * 52))}px` }} />
            <p className="mt-1 text-center text-[10px] text-slate-500">{p.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
