type Props = {
  label: string;
  value: string | number;
  sub?: string | null;
  isPlaceholder?: boolean;
};

export function ClientMetricCard({ label, value, sub, isPlaceholder }: Props) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        isPlaceholder
          ? "border-slate-600/40 bg-slate-900/30"
          : "border-cyan-500/20 bg-slate-900/50"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-100">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}
