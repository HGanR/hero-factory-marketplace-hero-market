"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export function CacRiskGauge({ cac, aov }: { cac: number; aov: number }) {
  const pct = aov > 0 ? (cac / aov) * 100 : 0;
  const risk = pct <= 33 ? "Safe" : pct <= 50 ? "Caution" : "Risk";

  const fillColor = pct <= 33 ? "#22c55e" : pct <= 50 ? "#eab308" : "#ef4444";

  const data = [
    { name: "CAC % of AOV", value: Math.min(pct, 100), fill: fillColor },
    { name: "Remainder", value: Math.max(0, 100 - Math.min(pct, 100)), fill: "rgba(55,65,81,0.4)" },
  ];

  return (
    <div className="rounded-2xl border border-cyan-500/50 bg-slate-800/50 p-5">
      <div className="text-sm text-gray-300 font-semibold">CAC Risk Band</div>
      <div className="text-xs text-gray-500 mt-1">
        CAC as % of AOV — Safe ≤ 33%, Caution 33–50%, Risk &gt; 50%
      </div>

      <div className="h-56 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              formatter={(v) => [`${typeof v === "number" ? v.toFixed(1) : "0"}%`, ""]}
              contentStyle={{ backgroundColor: "#111", border: "1px solid #00D1FF" }}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={85}
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} stroke="none" />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 text-center">
        <div className="text-2xl font-bold" style={{ color: fillColor }}>
          {pct.toFixed(1)}%
        </div>
        <div className="text-xs text-gray-500 mt-1">CAC % of AOV</div>
        <div className="text-sm font-semibold mt-1" style={{ color: fillColor }}>
          {risk}
        </div>
      </div>
    </div>
  );
}
