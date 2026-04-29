"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const GOLD = "#D4AF37";

export function ProjectionCurveChart({
  baselineRevenue,
  yourRevenue,
}: {
  baselineRevenue: number;
  yourRevenue: number;
}) {
  const data = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, i) => ({
        month: `M${i + 1}`,
        baseline: baselineRevenue,
        yours: yourRevenue,
      })),
    [baselineRevenue, yourRevenue]
  );

  const money = (v: number) =>
    v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="mt-8 rounded-2xl border border-[#D4AF37]/50 bg-black/40 p-5"
    >
      <div className="text-sm text-gray-300 font-semibold">
        Projected Curve (6 months)
      </div>
      <div className="text-xs text-gray-500 mt-1">
        Baseline (industry default) vs your scenario
      </div>

      <div className="mt-4 w-full" style={{ height: 192 }}>
        <ResponsiveContainer width="100%" height={192}>
          <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.15)" />
            <XAxis dataKey="month" stroke="#6b7280" fontSize={10} />
            <YAxis stroke="#6b7280" fontSize={10} tickFormatter={(v) => `$${((Number(v) || 0) / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: "#111", border: "1px solid #D4AF37" }}
              formatter={(v) => [money(typeof v === "number" ? v : 0), ""]}
              labelFormatter={(l) => `Month: ${l}`}
            />
            <Line
              type="monotone"
              dataKey="baseline"
              name="Baseline"
              stroke="#6b7280"
              strokeWidth={2}
              dot={{ r: 2 }}
              strokeDasharray="4 4"
            />
            <Line
              type="monotone"
              dataKey="yours"
              name="Your scenario"
              stroke={GOLD}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex gap-6 text-xs">
        <span className="text-gray-500">
          Baseline: {money(baselineRevenue)}
        </span>
        <span style={{ color: GOLD }}>
          Yours: {money(yourRevenue)}
        </span>
      </div>
    </motion.div>
  );
}
