import type { ClientHealthSnapshot } from "@/lib/revenue-os/client-hub-types";

const ring: Record<ClientHealthSnapshot["status"], string> = {
  thriving: "border-emerald-400/50 bg-emerald-500/15 text-emerald-100",
  healthy: "border-cyan-400/45 bg-cyan-500/12 text-cyan-50",
  steady: "border-amber-400/40 bg-amber-500/12 text-amber-100",
  at_risk: "border-rose-400/45 bg-rose-500/15 text-rose-100",
};

type Props = {
  score: number;
  label: string;
  status?: ClientHealthSnapshot["status"];
  className?: string;
};

export function ClientHealthBadge({ score, label, status = "steady", className = "" }: Props) {
  const cls = ring[status] ?? ring.steady;
  return (
    <span
      title={`Health score ${score}/100`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums ${cls} ${className}`}
    >
      <span>{label}</span>
      <span className="opacity-80">{score}</span>
    </span>
  );
}
