"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const ACCENT = "#00D1FF";

type Snapshot = {
  month: string;
  cac: number;
};

export function CacTrendChart({
  snapshots,
}: {
  snapshots: Snapshot[];
}) {
  if (snapshots.length < 2) return null;

  const data = [...snapshots].reverse();

  const money = (v: number) =>
    v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="rounded-2xl border border-[#00D1FF]/50 bg-slate-800/50 p-5">
      <div className="text-sm text-gray-300 font-semibold">CAC Trend</div>
      <div className="text-xs text-gray-500 mt-1">Month-over-month CAC from snapshots</div>

      <div className="h-40 mt-4 min-h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,209,255,0.2)" />
            <XAxis dataKey="month" stroke="#9ca3af" fontSize={10} />
            <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{ backgroundColor: "#111", border: "1px solid #00D1FF" }}
              formatter={(v) => [money(typeof v === "number" ? v : 0), "CAC"]}
              labelFormatter={(l) => `Month: ${l}`}
            />
            <Line
              type="monotone"
              dataKey="cac"
              name="CAC"
              stroke={ACCENT}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
