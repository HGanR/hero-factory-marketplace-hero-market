type Props = { status: string; className?: string };

const palette: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  paused: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  churned: "bg-rose-500/15 text-rose-200 border-rose-500/30",
  DRAFT: "bg-slate-500/20 text-slate-200 border-slate-500/30",
  PUBLISHED: "bg-cyan-500/15 text-cyan-200 border-cyan-500/30",
  ARCHIVED: "bg-slate-600/30 text-slate-300 border-slate-500/25",
};

export function ClientStatusBadge({ status, className = "" }: Props) {
  const key = status?.trim() || "unknown";
  const cls = palette[key] ?? "bg-cyan-500/10 text-cyan-100 border-cyan-500/25";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${cls} ${className}`}
    >
      {key}
    </span>
  );
}
