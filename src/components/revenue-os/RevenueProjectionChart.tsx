"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  CartesianGrid,
} from "recharts";

const ACCENT = "#00D1FF";

export function RevenueProjectionChart({
  current,
  optimized,
  industryMedian,
}: {
  current: number;
  optimized: number;
  industryMedian?: number;
}) {
  const data = Array.from({ length: 6 }).map((_, i) => {
    const m = i + 1;
    const optStep = current + (optimized - current) * (m / 6);
    return {
      month: `M${m}`,
      current,
      optimized: optStep,
      industry: industryMedian ?? null,
    };
  });

  const money = (v: number) =>
    v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="rounded-2xl border border-[#00D1FF]/50 bg-slate-800/50 p-5">
      <div className="text-sm text-gray-300 font-semibold">Revenue Projection</div>
      <div className="text-xs text-gray-500 mt-1">Current vs Optimized (6-month view)</div>

      <div className="h-72 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.2)" />
            <XAxis dataKey="month" stroke="#9ca3af" fontSize={11} />
            <YAxis stroke="#9ca3af" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: "#111", border: "1px solid #00D1FF" }}
              formatter={(v) => [money(typeof v === "number" ? v : 0), ""]}
              labelFormatter={(l) => `Month: ${l}`}
            />
            {industryMedian != null && (
              <ReferenceArea
                y1={industryMedian * 0.9}
                y2={industryMedian * 1.1}
                fill="#00D1FF"
                fillOpacity={0.15}
              />
            )}
            <Line type="monotone" dataKey="current" name="Current" stroke="#6b7280" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="optimized" name="Optimized" stroke={ACCENT} strokeWidth={2} dot={{ r: 3 }} />
            {industryMedian != null && (
              <Line
                type="monotone"
                dataKey="industry"
                name="Industry band"
                stroke={ACCENT}
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
