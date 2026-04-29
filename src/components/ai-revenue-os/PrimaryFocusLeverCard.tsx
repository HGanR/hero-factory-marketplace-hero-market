"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { computeLeverDeltas } from "@/lib/revenue-os/focus-lever";
import { SevenDayFocusPlan } from "./SevenDayFocusPlan";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F5C518";

export function PrimaryFocusLeverCard({
  traffic,
  conversion,
  aov,
}: {
  traffic: number;
  conversion: number;
  aov: number;
}) {
  const levers = useMemo(
    () => computeLeverDeltas(traffic, conversion, aov),
    [traffic, conversion, aov]
  );

  const focus = useMemo(
    () => levers.reduce((a, b) => (a.delta >= b.delta ? a : b)),
    [levers]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-8 rounded-2xl border-2 p-6"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        borderColor: GOLD_LIGHT,
        boxShadow: `0 0 30px rgba(245,197,24,0.2)`,
      }}
    >
      <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">
        Primary Focus Lever
      </div>
      <div className="text-xl font-bold" style={{ color: GOLD_LIGHT }}>
        {focus.label} (highest leverage)
      </div>
      <p className="text-gray-400 text-sm mt-2">{focus.why}</p>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
        {levers.map((l) => (
          <span
            key={l.lever}
            className={
              l.lever === focus.lever
                ? "font-semibold"
                : ""
            }
            style={
              l.lever === focus.lever
                ? { color: GOLD }
                : undefined
            }
          >
            {l.label}: ${l.delta.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
          </span>
        ))}
      </div>

      <SevenDayFocusPlan lever={focus.lever} />
    </motion.div>
  );
}
