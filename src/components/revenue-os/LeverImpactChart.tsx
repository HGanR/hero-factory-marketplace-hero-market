"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

const ACCENT = "#00D1FF";
const ACCENT_LIGHT = "#7DF9FF";
const ACCENT_DARK = "#06b6d4";

export function LeverImpactChart({
  baseRevenue,
  convOnly,
  aovOnly,
  trafficOnly,
}: {
  baseRevenue: number;
  convOnly: number;
  aovOnly: number;
  trafficOnly: number;
}) {
  const data = [
    { lever: "Base", revenue: baseRevenue, fill: ACCENT_DARK },
    { lever: "Conversion", revenue: convOnly, fill: ACCENT },
    { lever: "AOV", revenue: aovOnly, fill: ACCENT_LIGHT },
    { lever: "Traffic", revenue: trafficOnly, fill: ACCENT_DARK },
  ];

  const money = (v: number) =>
    v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="rounded-2xl border border-cyan-500/50 bg-slate-800/50 p-5">
      <div className="text-sm text-gray-300 font-semibold">Lever Impact Simulation</div>
      <div className="text-xs text-gray-500 mt-1">Revenue impact if only one lever improves</div>

      <div className="h-72 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.2)" />
            <XAxis dataKey="lever" stroke="#9ca3af" fontSize={11} />
            <YAxis stroke="#9ca3af" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: "#111", border: "1px solid #D4AF37" }}
              formatter={(v) => [money(typeof v === "number" ? v : 0), "Revenue"]}
              labelFormatter={(l) => `Lever: ${l}`}
            />
            <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
