"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

const GOLD = "#D4AF37";

type Snapshot = {
  month: string;
  revenue: number;
  traffic?: number;
  conversionRatePct?: number;
  avgOrderValue?: number;
};

export function GrowthTrajectoryChart({
  snapshots,
  industry,
}: {
  snapshots: Snapshot[];
  industry: string;
}) {
  const [industryRevenue, setIndustryRevenue] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/revenue-os/benchmarks?industry=${encodeURIComponent(industry)}`
        );
        const j = await r.json();
        if (ignore) return;
        const conv = (j.benchmarks ?? []).find(
          (b: { metric: string }) =>
            b.metric === "conversion_rate_pct" || b.metric === "conversion_rate"
        );
        if (conv && snapshots.length > 0) {
          const latest = snapshots[snapshots.length - 1];
          const traffic = latest.traffic ?? 8000;
          const aov = latest.avgOrderValue ?? 5000;
          const convPct = Number(conv.value) / 100;
          setIndustryRevenue(traffic * convPct * aov);
        }
      } catch {
        if (!ignore) setIndustryRevenue(null);
      }
    })();
    return () => { ignore = true; };
  }, [industry, snapshots]);

  if (snapshots.length < 2) return null;

  const data = [...snapshots].reverse();

  const money = (v: number) =>
    v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="rounded-2xl border border-[#D4AF37]/50 bg-black/50 p-5">
      <div className="text-sm text-gray-300 font-semibold">Growth Trajectory</div>
      <div className="text-xs text-gray-500 mt-1">
        Your revenue vs industry median band
      </div>

      <div className="h-40 mt-4 min-h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.2)" />
            <XAxis dataKey="month" stroke="#9ca3af" fontSize={10} />
            <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: "#111", border: "1px solid #D4AF37" }}
              formatter={(v) => [money(typeof v === "number" ? v : 0), "Revenue"]}
              labelFormatter={(l) => `Month: ${l}`}
            />
            {industryRevenue != null && (
              <ReferenceLine
                y={industryRevenue}
                stroke={GOLD}
                strokeDasharray="4 4"
                strokeOpacity={0.6}
              />
            )}
            <Line
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={GOLD}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {industryRevenue != null && (
        <div className="mt-2 text-xs text-gray-500">
          Dashed: industry median band ({industry})
        </div>
      )}
    </div>
  );
}
