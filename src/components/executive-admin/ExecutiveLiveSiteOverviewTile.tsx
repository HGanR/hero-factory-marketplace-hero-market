"use client";

import type { LiveMetricsResponse } from "@/lib/executive-agent/executive-live-metrics";

type Props = {
  metrics: LiveMetricsResponse | null;
  loading?: boolean;
  error?: string | null;
};

function formatMetric(value: number | null | undefined, unavailable?: boolean): string {
  if (unavailable || value == null) return "Unavailable";
  return value.toLocaleString("en-US");
}

function formatPercent(value: number | null | undefined, unavailable?: boolean): string {
  if (unavailable || value == null) return "No data yet";
  return `${(value * 100).toFixed(1)}%`;
}

function Sparkline({ values, color = "#00A3FF" }: { values: number[]; color?: string }) {
  if (!values.length) {
    return <div className="h-10 w-full rounded bg-[#00050A]/60" />;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 100 / Math.max(values.length - 1, 1);

  const points = values
    .map((v, i) => {
      const x = i * w;
      const y = 100 - ((v - min) / range) * 80 - 10;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-10 w-full">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function MiniTrend({
  label,
  values,
  color,
}: {
  label: string;
  values: number[];
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-[#00A3FF]/15 bg-[#00050A]/60 px-2 py-2">
      <p className="text-[8px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <Sparkline values={values} color={color} />
    </div>
  );
}

export function ExecutiveLiveSiteOverviewTile({ metrics, loading, error }: Props) {
  const trend = metrics?.siteTrend?.items ?? [];
  const visitorTrend = trend.map((p) => p.visitors);
  const pageViewTrend = trend.map((p) => p.pageViews);
  const conversionTrend = trend.map((p) => p.conversions);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#00A3FF]/30 bg-[#000814]/85 p-4 shadow-[0_0_32px_rgba(0,163,255,0.12),inset_0_0_24px_rgba(0,163,255,0.06)] backdrop-blur-md">
      <div className="pointer-events-none absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#00A3FF]/90">
          Live site overview
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">7-day site analytics · real traffic events only</p>
        {error ? <p className="mt-2 text-xs text-amber-200/90">{error}</p> : null}
        {loading && !metrics ? (
          <p className="mt-4 text-xs text-slate-500">Loading site analytics…</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-[#00A3FF]/20 bg-[#00050A]/70 px-2 py-2">
                <p className="text-[8px] uppercase tracking-[0.16em] text-slate-500">Active visitors</p>
                <p className="mt-1 font-mono text-lg text-white">
                  {formatMetric(metrics?.activeVisitors.value, metrics?.activeVisitors.unavailable)}
                </p>
              </div>
              <div className="rounded-xl border border-[#00A3FF]/20 bg-[#00050A]/70 px-2 py-2">
                <p className="text-[8px] uppercase tracking-[0.16em] text-slate-500">Page views</p>
                <p className="mt-1 font-mono text-lg text-white">
                  {formatMetric(metrics?.pageViews.value, metrics?.pageViews.unavailable)}
                </p>
              </div>
              <div className="rounded-xl border border-[#00A3FF]/20 bg-[#00050A]/70 px-2 py-2">
                <p className="text-[8px] uppercase tracking-[0.16em] text-slate-500">Conversions</p>
                <p className="mt-1 font-mono text-lg text-white">
                  {formatMetric(metrics?.conversions.value, metrics?.conversions.unavailable)}
                </p>
              </div>
              <div className="rounded-xl border border-[#00A3FF]/20 bg-[#00050A]/70 px-2 py-2">
                <p className="text-[8px] uppercase tracking-[0.16em] text-slate-500">Single-page visits</p>
                <p className="mt-1 font-mono text-lg text-white">
                  {formatPercent(metrics?.bounceRate.value, metrics?.bounceRate.unavailable)}
                </p>
              </div>
            </div>
            {metrics?.siteTrend.unavailable || trend.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">Traffic trend — no data yet</p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <MiniTrend label="Visitors" values={visitorTrend} />
                <MiniTrend label="Page views" values={pageViewTrend} color="#22d3ee" />
                <MiniTrend label="Conversions" values={conversionTrend} color="#34d399" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
