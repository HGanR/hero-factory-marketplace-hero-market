"use client";

import dynamic from "next/dynamic";

/**
 * Recharts + Next/webpack can hit init-order / TDZ issues when the chart shares a
 * heavy client chunk with the rest of AI Revenue OS. Loading the chart in its own
 * chunk after paint avoids `ReferenceError: Cannot access '…' before initialization`
 * seen in production for this route.
 */
export const ProjectionCurveChartLazy = dynamic(
  () => import("./ProjectionCurveChart").then((m) => m.ProjectionCurveChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="mt-8 h-48 rounded-2xl border border-[#D4AF37]/30 bg-black/20 animate-pulse"
        aria-hidden
      />
    ),
  }
);
